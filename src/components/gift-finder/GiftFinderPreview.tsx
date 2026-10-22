import React, { useState } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { GiftFinderData } from '../../types/giftFinder';

interface GiftFinderPreviewProps {
  data: GiftFinderData;
}

export function GiftFinderPreview({ data }: GiftFinderPreviewProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedValues, setSelectedValues] = useState<Record<string, any>>({});

  const activeStepObj = data.steps.find(s => s.step === currentStep) || data.steps[0];
  const progressPercent = Math.round(((currentStep - 1) / (data.steps.length || 6)) * 100);

  const handleSelectOption = (field: string, value: string) => {
    setSelectedValues(prev => {
      if (field === 'interests') {
        const currentArr = Array.isArray(prev[field]) ? prev[field] : [];
        if (currentArr.includes(value)) {
          return { ...prev, [field]: currentArr.filter((v: string) => v !== value) };
        } else {
          return { ...prev, [field]: [...currentArr, value] };
        }
      }
      return { ...prev, [field]: value };
    });
  };

  const isOptionSelected = (field: string, value: string) => {
    if (field === 'interests') {
      return Array.isArray(selectedValues[field]) && selectedValues[field].includes(value);
    }
    return selectedValues[field] === value;
  };

  return (
    <div className="bg-[#FAF9F6] border border-[#99BFF9]/40 p-6 sm:p-8 rounded-xl space-y-8 shadow-xs">
      {/* Header */}
      <div className="text-center space-y-3 pb-6 border-b border-[#99BFF9]/25">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#E8F8F1] border border-[#226E56]/30 text-[#154D3B] text-xs font-semibold uppercase tracking-wider rounded-full">
          <Sparkles className="w-3.5 h-3.5 text-[#226E56]" />
          <span>{data.badge || 'Editorial Gift Matching Engine'}</span>
        </div>
        <h1 className="font-serif-display text-2xl sm:text-3xl lg:text-4xl text-[#1E232B] font-normal leading-[1.2]">
          {data.title || 'Find the Exact Right Gift'}
        </h1>
        <p className="text-xs sm:text-sm text-[#5A6270] leading-relaxed max-w-xl mx-auto">
          {data.lead}
        </p>
      </div>

      {/* Questionnaire Card */}
      <div className="bg-white border border-[#99BFF9]/35 p-6 sm:p-8 space-y-6 rounded-lg">
        {/* Step Indicator & Progress Bar */}
        <div className="space-y-2 border-b border-[#99BFF9]/20 pb-4">
          <div className="flex items-center justify-between text-xs font-semibold text-[#2A548E] uppercase tracking-wider">
            <span>Step {currentStep} of {data.steps.length || 6} · {progressPercent}% Complete</span>
          </div>
          <div className="w-full h-1.5 bg-[#EEF5FF] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step Body */}
        {activeStepObj && (
          <div className="space-y-6">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center justify-between">
                <h2 className="font-serif-display text-xl sm:text-2xl text-[#1E232B] font-normal">
                  {activeStepObj.title}
                </h2>
                {activeStepObj.subBadge && (
                  <span className="text-xs text-[#226E56] font-semibold">{activeStepObj.subBadge}</span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-[#5A6270]">
                {activeStepObj.prompt}
              </p>
            </div>

            {/* Options Grid */}
            <div className={`grid gap-3 pt-2 ${
              activeStepObj.field === 'budget' || activeStepObj.field === 'personalityStyle'
                ? 'grid-cols-1 sm:grid-cols-2'
                : activeStepObj.field === 'occasion'
                ? 'grid-cols-2 sm:grid-cols-4'
                : 'grid-cols-2 sm:grid-cols-3'
            }`}>
              {activeStepObj.options.map((opt) => {
                const selected = isOptionSelected(activeStepObj.field, opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleSelectOption(activeStepObj.field, opt.value)}
                    className={`p-3.5 text-left border rounded transition-all cursor-pointer w-full ${
                      selected
                        ? 'bg-[#EEF5FF] border-[#2A548E] text-[#1E232B] font-medium shadow-xs'
                        : 'bg-[#FAF9F6] border-stone-200 text-[#1E232B] hover:border-[#99BFF9]'
                    }`}
                  >
                    <div className={opt.description ? 'font-semibold text-xs sm:text-sm' : 'text-xs sm:text-sm'}>
                      {opt.label}
                    </div>
                    {opt.description && (
                      <div className="text-[11px] text-[#5A6270] mt-1 leading-normal">
                        {opt.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Navigation Buttons */}
        <div className="pt-6 border-t border-[#99BFF9]/20 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className={`px-4 py-2 border border-stone-300 text-xs font-medium text-[#5A6270] hover:text-[#1E232B] rounded flex items-center gap-1 cursor-pointer ${
              currentStep === 1 ? 'opacity-30 cursor-not-allowed' : ''
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{data.prevButtonText || 'Previous'}</span>
          </button>

          <div className="flex items-center gap-3">
            {currentStep < data.steps.length ? (
              <button
                onClick={() => setCurrentStep(prev => Math.min(data.steps.length, prev + 1))}
                className="px-6 py-2.5 bg-gradient-to-r from-[#99BFF9] to-[#C3F3DF] text-[#1B365D] text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-xs rounded"
              >
                <span>{data.nextButtonText || 'Next Step'}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => alert('Simulated: Viewing recommendations in live preview!')}
                className="px-6 py-2.5 bg-gradient-to-r from-[#C3F3DF] to-[#99BFF9] text-[#1E232B] text-xs font-bold uppercase tracking-wider transition-opacity hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-xs rounded"
              >
                <Sparkles className="w-4 h-4 text-[#226E56]" />
                <span>{data.submitButtonText || 'View Recommendations'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
