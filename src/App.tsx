import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Dashboard } from './components/Dashboard';
import { UploadQueue } from './components/UploadQueue';
import { ValidationCenter } from './components/ValidationCenter';
import { TallyExportSync } from './components/TallyExportSync';
import { AuditTrailView } from './components/AuditTrailView';
import { MasterSettings } from './components/MasterSettings';
import { DocumentPreviewModal } from './components/DocumentPreviewModal';
import { FeedbackModal } from './components/FeedbackModal';
import { VoiceRecorderModal } from './components/VoiceRecorderModal';
import { LoginPage } from './components/LoginPage';
import { syncUserWithSupabase } from './services/supabaseClient';

import { 
  initialSettings, 
  initialChartOfAccounts, 
  initialTransactions, 
  initialAuditLogs 
} from './data/mockData';
import { 
  TransactionEntry, 
  ChartOfAccountItem, 
  OrganizationSettings, 
  AuditLog, 
  UserRole,
  FeedbackSubmission 
} from './types';
import { getNowLocalTimestamp } from './utils/formatters';

export function App() {
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'upload' | 'validation' | 'export' | 'audit' | 'settings'>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('CA');
  const [selectedClient, setSelectedClient] = useState<string>('Primary Enterprise');
  const [settings, setSettings] = useState<OrganizationSettings>(initialSettings);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccountItem[]>(initialChartOfAccounts);
  const [transactions, setTransactions] = useState<TransactionEntry[]>(initialTransactions);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(initialAuditLogs);
  const [tallyConnected, setTallyConnected] = useState<boolean>(true);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('tally_auth') === 'true';
    } catch {
      return false;
    }
  });
  const [currentUser, setCurrentUser] = useState<{ email: string; role: UserRole; name: string } | null>(() => {
    try {
      const saved = localStorage.getItem('tally_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (user: { email: string; role: UserRole; name: string }) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setUserRole(user.role);
    try {
      localStorage.setItem('tally_auth', 'true');
      localStorage.setItem('tally_user', JSON.stringify(user));
    } catch {
      // Ignore
    }
    // Asynchronously synchronize with Supabase (if configured)
    syncUserWithSupabase(user).catch(() => {});
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    try {
      localStorage.removeItem('tally_auth');
      localStorage.removeItem('tally_user');
    } catch {
      // Ignore
    }
  };

  // Modals
  const [previewTransaction, setPreviewTransaction] = useState<TransactionEntry | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);
  const [showVoiceModal, setShowVoiceModal] = useState<boolean>(false);

  // Theme state
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('tally_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tally_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tally_theme', 'light');
    }
  }, [darkMode]);

  // Global Alt+V keyboard shortcut for Voice Voucher Modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        setShowVoiceModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const pendingCount = transactions.filter(t => t.status === 'Pending').length;

  // Add new parsed transaction
  const handleAddTransaction = (newEntry: TransactionEntry) => {
    // Check for duplicate invoice
    const duplicate = transactions.find(t => 
      t.invoiceNumber.toLowerCase() === newEntry.invoiceNumber.toLowerCase() &&
      t.party.toLowerCase() === newEntry.party.toLowerCase()
    );

    if (duplicate) {
      newEntry.isDuplicateWarning = true;
      newEntry.duplicateMatchedWith = `${duplicate.invoiceNumber} (${duplicate.party})`;
    }

    setTransactions(prev => [newEntry, ...prev]);

    // Log to audit trail
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: userRole === 'CA' ? 'Chartered Accountant' : 'System AI Ingest',
      userRole,
      action: 'AI_EXTRACT',
      targetId: newEntry.invoiceNumber,
      details: `Extracted ${newEntry.voucherType} voucher for ${newEntry.party} (${newEntry.document.name}) with ${newEntry.confidence.overall}% confidence`,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Update transaction entry
  const handleUpdateTransaction = (updated: TransactionEntry) => {
    setTransactions(prev => prev.map(t => t.id === updated.id ? updated : t));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: userRole === 'CA' ? 'Chartered Accountant' : userRole,
      userRole,
      action: 'EDIT_FIELD',
      targetId: updated.invoiceNumber,
      details: `Modified voucher fields for ${updated.party}. Amount: ₹${updated.amount}, Ledger: ${updated.ledger}`,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Approve single transaction
  const handleApproveTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'Approved' } : t));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: userRole === 'CA' ? 'Chartered Accountant' : userRole,
      userRole,
      action: 'APPROVE',
      targetId: tx.invoiceNumber,
      details: `Approved voucher ${tx.invoiceNumber} (₹${tx.amount.toLocaleString('en-IN')}) for Tally Prime XML import`,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Reject single transaction
  const handleRejectTransaction = (id: string, reason?: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;

    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'Rejected', rejectionReason: reason } : t));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: userRole === 'CA' ? 'Chartered Accountant' : userRole,
      userRole,
      action: 'REJECT',
      targetId: tx.invoiceNumber,
      details: `Rejected voucher ${tx.invoiceNumber}. ${reason ? `Reason: ${reason}` : ''}`,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Batch approve
  const handleBatchApprove = (ids: string[]) => {
    setTransactions(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'Approved' } : t));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: userRole === 'CA' ? 'Chartered Accountant' : userRole,
      userRole,
      action: 'BATCH_APPROVE',
      targetId: `BATCH-${ids.length}`,
      details: `Batch approved ${ids.length} verified vouchers for Tally Prime`,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Batch reject
  const handleBatchReject = (ids: string[]) => {
    setTransactions(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'Rejected' } : t));

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: userRole === 'CA' ? 'Chartered Accountant' : userRole,
      userRole,
      action: 'REJECT',
      targetId: `BATCH-${ids.length}`,
      details: `Batch rejected ${ids.length} entries`,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Record export / sync log
  const handleRecordExportLog = (details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: userRole === 'CA' ? 'Chartered Accountant' : userRole,
      userRole,
      action: 'DIRECT_SYNC',
      targetId: `TALLY-EXP-${Date.now()}`,
      details,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  // Add ledger
  const handleAddLedger = (ledger: ChartOfAccountItem) => {
    setChartOfAccounts(prev => [...prev, ledger]);
  };

  // Handle feedback submit
  const handleFeedbackSubmit = (fb: FeedbackSubmission) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: getNowLocalTimestamp(),
      userName: 'User Feedback',
      userRole,
      action: 'APPROVE',
      targetId: fb.batchId,
      details: `Rated batch accuracy ${fb.rating}/5 stars. Tags: ${fb.tags.join(', ')}. Comments: ${fb.comments || 'None'}`,
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLogin={handleLogin}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
      />
    );
  }

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-[#090d16] text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col selection:bg-[#5F1915] selection:text-white transition-colors duration-200`}>
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        userRole={userRole}
        setUserRole={setUserRole}
        pendingCount={pendingCount}
        settings={settings}
        onOpenVoiceModal={() => setShowVoiceModal(true)}
        tallyConnected={tallyConnected}
        selectedClient={selectedClient}
        setSelectedClient={setSelectedClient}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(!darkMode)}
        onSignOut={handleSignOut}
        currentUser={currentUser}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {currentTab === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            userRole={userRole}
            settings={settings}
            onNavigateTab={setCurrentTab}
            onOpenVoiceModal={() => setShowVoiceModal(true)}
          />
        )}

        {currentTab === 'upload' && (
          <UploadQueue
            onAddTransaction={handleAddTransaction}
            onNavigateToValidation={() => setCurrentTab('validation')}
            onOpenVoiceModal={() => setShowVoiceModal(true)}
            chartOfAccounts={chartOfAccounts}
          />
        )}

        {currentTab === 'validation' && (
          <ValidationCenter
            transactions={transactions}
            chartOfAccounts={chartOfAccounts}
            onUpdateTransaction={handleUpdateTransaction}
            onApproveTransaction={handleApproveTransaction}
            onRejectTransaction={handleRejectTransaction}
            onBatchApprove={handleBatchApprove}
            onBatchReject={handleBatchReject}
            onViewDocument={(tx) => setPreviewTransaction(tx)}
            onOpenFeedback={() => setShowFeedbackModal(true)}
          />
        )}

        {currentTab === 'export' && (
          <TallyExportSync
            transactions={transactions}
            settings={settings}
            onRecordExportLog={handleRecordExportLog}
            tallyConnected={tallyConnected}
            setTallyConnected={setTallyConnected}
          />
        )}

        {currentTab === 'audit' && (
          <AuditTrailView logs={auditLogs} />
        )}

        {currentTab === 'settings' && (
          <MasterSettings
            settings={settings}
            onUpdateSettings={setSettings}
            chartOfAccounts={chartOfAccounts}
            onAddLedger={handleAddLedger}
          />
        )}
      </main>

      {/* Modals */}
      {previewTransaction && (
        <DocumentPreviewModal
          transaction={previewTransaction}
          onClose={() => setPreviewTransaction(null)}
          onApprove={handleApproveTransaction}
          onReject={handleRejectTransaction}
        />
      )}

      {showFeedbackModal && (
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          onSubmit={handleFeedbackSubmit}
        />
      )}

      {showVoiceModal && (
        <VoiceRecorderModal
          isOpen={showVoiceModal}
          onClose={() => setShowVoiceModal(false)}
          onAddTransaction={(tx) => {
            handleAddTransaction(tx);
            setCurrentTab('validation');
          }}
        />
      )}
    </div>
  );
}

export default App;
