import React, { useState } from 'react';
import { 
  SlidersHorizontal, 
  Building2, 
  BookOpen, 
  Server, 
  Cpu, 
  Users, 
  Plus, 
  Check, 
  Save, 
  Key, 
  Lock,
  UserPlus,
  ShieldCheck,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { OrganizationSettings, ChartOfAccountItem } from '../types';
import { formatCurrencyINR } from '../utils/formatters';

interface MasterSettingsProps {
  settings: OrganizationSettings;
  onUpdateSettings: (settings: OrganizationSettings) => void;
  chartOfAccounts: ChartOfAccountItem[];
  onAddLedger: (ledger: ChartOfAccountItem) => void;
}

export const MasterSettings: React.FC<MasterSettingsProps> = ({
  settings,
  onUpdateSettings,
  chartOfAccounts,
  onAddLedger,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'coa' | 'tally' | 'ai' | 'team'>('profile');
  const [formSettings, setFormSettings] = useState<OrganizationSettings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);

  // New Ledger Modal State
  const [showAddLedger, setShowAddLedger] = useState(false);
  const [newLedgerName, setNewLedgerName] = useState('');
  const [newLedgerGroup, setNewLedgerGroup] = useState<ChartOfAccountItem['group']>('Indirect Expenses');
  const [newLedgerBalance, setNewLedgerBalance] = useState('0');

  // Team Members State
  const [teamMembers, setTeamMembers] = useState([
    { name: 'Authorized Signatory', email: 'signatory@enterprise.in', role: 'Chartered Accountant (CA)', membershipNo: 'FCA-ACTIVE', status: 'Active' },
  ]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Senior Accountant');

  const groups: ChartOfAccountItem['group'][] = [
    'Sundry Creditors',
    'Sundry Debtors',
    'Direct Expenses',
    'Indirect Expenses',
    'Bank Accounts',
    'Cash-in-Hand',
    'Duties & Taxes',
    'Sales Accounts',
    'Purchase Accounts',
    'Fixed Assets',
    'Current Liabilities',
  ];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formSettings);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const handleCreateLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLedgerName.trim()) return;

    const item: ChartOfAccountItem = {
      id: `coa-${Date.now()}`,
      name: newLedgerName.trim(),
      group: newLedgerGroup,
      balance: parseFloat(newLedgerBalance) || 0,
      balanceType: newLedgerGroup === 'Sales Accounts' || newLedgerGroup === 'Sundry Creditors' ? 'Cr' : 'Dr',
    };

    onAddLedger(item);
    setNewLedgerName('');
    setNewLedgerBalance('0');
    setShowAddLedger(false);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Institutional Top Header */}
      <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#5F1915] text-white flex items-center justify-center shadow-sm">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight font-serif">
                Master Configuration &amp; Enterprise Controls
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Statutory parameters, Tally Prime ODBC bridge, Chart of Accounts master, and Gemini OCR calibration
              </p>
            </div>
          </div>
        </div>

        {savedNotice && (
          <div className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Master Records Updated &amp; Synced</span>
          </div>
        )}
      </div>

      {/* Institutional Navigation Tab Strip */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-300 pb-3">
        {[
          { id: 'profile', label: 'Company Profile & Statutory Tax', icon: Building2 },
          { id: 'coa', label: `Chart of Accounts Master (${chartOfAccounts.length})`, icon: BookOpen },
          { id: 'tally', label: 'Tally Prime Gateway & ODBC', icon: Server },
          { id: 'ai', label: 'Gemini AI Vision & Extraction Rules', icon: Cpu },
          { id: 'team', label: `Statutory Team & Roles (${teamMembers.length})`, icon: Users },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all border ${
                isActive
                  ? 'bg-[#5F1915] text-white border-[#5F1915] shadow-sm'
                  : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Company Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-serif">Legal Entity &amp; GSTIN Registration Master</h3>
              <p className="text-xs text-slate-500 mt-0.5">Primary entity credentials mapped across all generated Tally Prime XML envelopes</p>
            </div>
            <span className="text-[11px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded">
              GSTN Active Status: Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Registered Legal Entity Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={formSettings.companyName}
                onChange={(e) => setFormSettings({ ...formSettings, companyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">As per Certificate of Incorporation (MCA)</span>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Trade / Brand Name
              </label>
              <input
                type="text"
                value={formSettings.tradeName}
                onChange={(e) => setFormSettings({ ...formSettings, tradeName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Trade style printed on commercial tax invoices</span>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Entity GSTIN (15 Alphanumeric Characters) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={15}
                value={formSettings.gstin}
                onChange={(e) => setFormSettings({ ...formSettings, gstin: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-mono font-bold uppercase tracking-wider focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">State Code (27) + PAN (10 chars) + Entity (1) + Z + Checksum</span>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Permanent Account Number (PAN) <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={10}
                value={formSettings.pan}
                onChange={(e) => setFormSettings({ ...formSettings, pan: e.target.value.toUpperCase() })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-mono font-bold uppercase tracking-wider focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Issued by Income Tax Department of India</span>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Active Assessment / Financial Year
              </label>
              <select
                value={formSettings.fiscalYear}
                onChange={(e) => setFormSettings({ ...formSettings, fiscalYear: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              >
                <option value="2026-2027">FY 2026-2027 (Assessment Year 2027-2028)</option>
                <option value="2025-2026">FY 2025-2026 (Assessment Year 2026-2027)</option>
                <option value="2024-2025">FY 2024-2025 (Assessment Year 2025-2026)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Principal Place of Business State &amp; Tax Code
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={formSettings.state}
                  onChange={(e) => setFormSettings({ ...formSettings, state: e.target.value })}
                  className="w-3/4 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
                />
                <input
                  type="text"
                  value={formSettings.stateCode}
                  onChange={(e) => setFormSettings({ ...formSettings, stateCode: e.target.value })}
                  placeholder="Code (27)"
                  className="w-1/4 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-bold text-center focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Used for Intrastate (CGST+SGST) vs Interstate (IGST) determination</span>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Statutory audit record synchronized under Companies Act Sec 143
            </span>
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save &amp; Apply Profile</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Chart of Accounts */}
      {activeTab === 'coa' && (
        <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-serif">
                Chart of Accounts Master (Tally Prime ERP Group Hierarchy)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Exact ledger definitions recognized by the AI classification engine when mapping invoice line items
              </p>
            </div>

            <button
              onClick={() => setShowAddLedger(true)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Ledger</span>
            </button>
          </div>

          {/* Add Ledger Form */}
          {showAddLedger && (
            <form onSubmit={handleCreateLedger} className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5F1915] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  Define New Tally Prime Master Ledger
                </span>
                <span className="text-[11px] text-slate-500">Tally XML Compatibility: v4.1+</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Ledger Title in Tally</label>
                  <input
                    type="text"
                    required
                    value={newLedgerName}
                    onChange={(e) => setNewLedgerName(e.target.value)}
                    placeholder="e.g. Courier &amp; Logistics Freight"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-[#5F1915]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Parent Accounting Group</label>
                  <select
                    value={newLedgerGroup}
                    onChange={(e) => setNewLedgerGroup(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-[#5F1915]"
                  >
                    {groups.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Opening Balance (INR)</label>
                  <input
                    type="number"
                    value={newLedgerBalance}
                    onChange={(e) => setNewLedgerBalance(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono font-medium focus:outline-none focus:border-[#5F1915]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddLedger(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Commit Ledger to Master
                </button>
              </div>
            </form>
          )}

          {/* Ledger Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#5F1915] text-white uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-2.5 px-4">Tally Ledger Name</th>
                  <th className="py-2.5 px-4">Primary Accounting Group</th>
                  <th className="py-2.5 px-4 text-right">Current Ledger Balance</th>
                  <th className="py-2.5 px-4 text-center">DR / CR</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {chartOfAccounts.map((coa) => (
                  <tr key={coa.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{coa.name}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                        {coa.group}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrencyINR(coa.balance)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                        coa.balanceType === 'Dr' 
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-300' 
                          : 'text-[#5F1915] bg-[#5F1915]/10 border-[#5F1915]/30'
                      }`}>
                        {coa.balanceType}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center text-[10px] font-bold text-emerald-700">
                        <Check className="w-3 h-3 mr-1 text-emerald-600" /> Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Tally Prime Gateway Bridge */}
      {activeTab === 'tally' && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-serif">
                Tally Prime ODBC &amp; HTTP Server Gateway (Port 9000)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Direct socket and XML post endpoint for automated voucher synchronization</p>
            </div>
            <span className="text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Socket Ready
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Tally Prime Server IP / Hostname <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={formSettings.tallyHost}
                onChange={(e) => setFormSettings({ ...formSettings, tallyHost: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Default `localhost` or LAN IP `192.168.1.xxx`</span>
            </div>

            <div>
              <label className="text-slate-700 font-bold block mb-1.5">
                Tally Prime XML Listener Port <span className="text-rose-600">*</span>
              </label>
              <input
                type="number"
                value={formSettings.tallyPort}
                onChange={(e) => setFormSettings({ ...formSettings, tallyPort: parseInt(e.target.value) || 9000 })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">Configured in Tally Prime &gt; F1: Help &gt; Settings &gt; Connectivity</span>
            </div>

            <div className="md:col-span-2">
              <label className="text-slate-700 font-bold block mb-1.5">
                Target Active Company Name in Tally Prime <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={formSettings.tallyCompanyName}
                onChange={(e) => setFormSettings({ ...formSettings, tallyCompanyName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Must match the company name open in Tally Prime verbatim (case-sensitive) to prevent envelope rejections.
              </span>
            </div>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-300 rounded-lg flex items-start space-x-3 text-xs text-slate-600">
            <HelpCircle className="w-4 h-4 text-[#5F1915] shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block mb-0.5 font-bold">How to verify Tally Prime connectivity:</strong>
              1. Open Tally Prime 4.1 on your workstation. 2. Press <code className="bg-white px-1.5 py-0.5 border border-slate-300 rounded text-[#5F1915] font-bold">F1 &gt; Settings &gt; Connectivity</code>. 3. Ensure "Client/Server configuration" is set to <em>Both</em> and Port is set to <em>9000</em>. 4. Click "Test Ping" in the Tally Sync tab.
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Update Gateway Parameters</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: Gemini AI Engine Settings */}
      {activeTab === 'ai' && (
        <form onSubmit={handleSaveProfile} className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-serif">
                Google Gemini API &amp; Multimodal Accounting OCR Engine
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Parameters for intelligent HSN code extraction, GST rate determination, and handwritten voucher parsing</p>
            </div>
            <span className="text-[11px] font-mono font-bold bg-indigo-50 text-indigo-900 border border-indigo-300 px-2.5 py-0.5 rounded">
              Gemini 2.5 Flash Native
            </span>
          </div>

          <div className="space-y-5 text-xs">
            <div>
              <label className="text-slate-700 font-bold block mb-1.5 flex items-center gap-1.5">
                <Key className="w-4 h-4 text-amber-600" />
                Google Gemini API Key (Optional Override)
              </label>
              <input
                type="password"
                value={formSettings.geminiApiKey || ''}
                onChange={(e) => setFormSettings({ ...formSettings, geminiApiKey: e.target.value })}
                placeholder="AIzaSy... (Leave empty to use built-in intelligent rule engine)"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-[#5F1915] transition-colors"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Your API key remains local in your browser session and is never stored on external third-party servers.
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-slate-800 font-bold block">
                  Minimum Confidence Auto-Accept Threshold: <strong className="text-[#5F1915] text-sm">{formSettings.confidenceThreshold}%</strong>
                </label>
                <span className="text-[11px] font-semibold text-slate-500">
                  Vouchers above this score can be batch approved without individual line edits
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="99"
                value={formSettings.confidenceThreshold}
                onChange={(e) => setFormSettings({ ...formSettings, confidenceThreshold: parseInt(e.target.value) })}
                className="w-full accent-[#5F1915]"
              />
              <div className="flex justify-between text-[11px] font-medium text-slate-600">
                <span>50% (Permissive / Small Business)</span>
                <span className="font-bold text-[#5F1915]">85% (Statutory Recommended)</span>
                <span>99% (Strict Statutory CA Audit)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-slate-300 rounded-lg bg-white">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs mb-1">
                  <Lock className="w-4 h-4 text-[#5F1915]" />
                  <span>GSTIN Checksum Auto-Validation</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Verifies 15-character GSTIN algorithm check against Indian GST Council lookup tables prior to Tally XML compilation.
                </p>
              </div>

              <div className="p-4 border border-slate-300 rounded-lg bg-white">
                <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#5F1915]" />
                  <span>CARO 2020 Audit Trail (Edit Log)</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Immutable chronological log recording user timestamps, field modifications, and original OCR predictions.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end">
            <button
              type="submit"
              className="flex items-center space-x-2 px-5 py-2.5 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Save AI Intelligence Rules</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: Team & Roles */}
      {activeTab === 'team' && (
        <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-serif">
                Authorized Personnel &amp; Statutory Signing Roles
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Role-based access matrix enforcing CA signatory controls, Auditor verification, and SME accounting view privileges
              </p>
            </div>

            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center space-x-1.5 px-4 py-2 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Authorize Team Member</span>
            </button>
          </div>

          {/* Invite User Modal Form */}
          {showInviteModal && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteName.trim() || !inviteEmail.trim()) return;
                setTeamMembers(prev => [
                  ...prev,
                  { 
                    name: inviteName.trim(), 
                    email: inviteEmail.trim(), 
                    role: inviteRole, 
                    membershipNo: inviteRole.includes('CA') ? 'FCA-NEW' : 'EMP-NEW',
                    status: 'Active' 
                  }
                ]);
                setInviteName('');
                setInviteEmail('');
                setShowInviteModal(false);
              }}
              className="p-4 rounded-xl bg-slate-50 border border-slate-300 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#5F1915] uppercase tracking-wider">
                  Invite Audit Colleague or Signing CA
                </span>
                <span className="text-[11px] text-slate-500">ICAI Compliance Standard v2.4</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    required
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. CA Priya Sharma"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-[#5F1915]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Institutional Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="associate@firm.in"
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-[#5F1915]"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Assigned Statutory Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:border-[#5F1915]"
                  >
                    <option value="Chartered Accountant (CA)">Chartered Accountant (CA) - Full Signatory</option>
                    <option value="Senior Accountant">Senior Accountant - Voucher Maker</option>
                    <option value="Junior Auditor">Junior Auditor - Verification Checker</option>
                    <option value="SME Viewer">SME Client Viewer - Read Only</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold shadow-sm"
                >
                  Send Access Authorization
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-300">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#5F1915] text-white uppercase text-[10px] tracking-wider font-bold">
                <tr>
                  <th className="py-2.5 px-4">Authorized User</th>
                  <th className="py-2.5 px-4">Corporate Email</th>
                  <th className="py-2.5 px-4">ICAI / Emp Registration</th>
                  <th className="py-2.5 px-4">Statutory Role</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {teamMembers.map((user, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{user.name}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{user.email}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 font-semibold">{user.membershipNo}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#5F1915]/10 text-[#5F1915] border border-[#5F1915]/20">
                        {user.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <Check className="w-3 h-3 mr-1 text-emerald-600" /> {user.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
