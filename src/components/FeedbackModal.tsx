import React, { useState } from 'react';
import { Star, X, CheckCircle2, Sparkles } from 'lucide-react';
import { FeedbackSubmission } from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackSubmission) => void;
  batchId?: string;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  batchId = 'BATCH-OCT-2026',
}) => {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [selectedTags, setSelectedTags] = useState<string[]>(['Accurate Ledger Matching', 'Correct GST Split']);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const availableTags = [
    'Accurate Ledger Matching',
    'Correct GST Split',
    'Perfect Handwriting Extraction',
    'Right Voucher Categorization',
    'Need Better Narration',
    'Party Name Ambiguity',
  ];

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      id: `fb-${Date.now()}`,
      batchId,
      rating,
      tags: selectedTags,
      comments,
      timestamp: new Date().toISOString(),
      user: 'Current User',
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      onClose();
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden">
        
        {submitted ? (
          <div className="py-12 text-center space-y-3 px-6">
            <div className="w-14 h-14 bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 font-serif">Feedback Recorded Successfully</h3>
            <p className="text-xs text-slate-600 max-w-xs mx-auto">
              Your ratings and correction data have been committed to the AI Accounting Intelligence retraining pipeline under audit trail.
            </p>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="px-6 py-3.5 bg-[#5F1915] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-serif">Batch AI Extraction Accuracy Feedback</h3>
                  <p className="text-xs text-slate-200">Help the intelligence engine learn your firm's ledger preferences</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Star Rating */}
              <div className="text-center">
                <span className="text-xs text-slate-500 uppercase font-bold tracking-wider block mb-2">
                  Rate Overall Extraction Precision
                </span>
                <div className="flex justify-center items-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1.5 focus:outline-none transition-transform hover:scale-125"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          (hoverRating || rating) >= star
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-bold text-slate-700 mt-1.5 block">
                  {rating === 5 ? '5 Stars — Flawless Extraction (No manual edits required)' :
                   rating === 4 ? '4 Stars — Minor field corrections needed' :
                   rating === 3 ? '3 Stars — Acceptable but required manual review' :
                   rating === 2 ? '2 Stars — Notable corrections were needed' :
                   '1 Star — Poor recognition accuracy'}
                </span>
              </div>

              {/* Quick Tags */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  What worked well or needs improvement?
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => {
                    const isSelected = selectedTags.includes(tag);
                    return (
                      <button
                        type="button"
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#5F1915] text-white border-[#5F1915]'
                            : 'bg-slate-50 text-slate-600 border-slate-300 hover:border-slate-400'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comments */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Comments or Specific Corrections for Future Batches
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="e.g. Swiggy food bills should always map to Staff Welfare instead of Travel Expense..."
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2.5 text-xs text-slate-900 font-medium placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#5F1915] resize-none transition-colors"
                />
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Skip for Now
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#5F1915] hover:bg-[#45120f] text-white rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  Submit Feedback to AI Pipeline
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
