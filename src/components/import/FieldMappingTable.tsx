import React, { useState } from 'react';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  EyeOff,
  Sparkles,
  ArrowRight,
  Edit2,
  Check,
  X,
  RotateCcw
} from 'lucide-react';
import {
  FieldMappingItem,
  CANONICAL_DESTINATION_FIELDS,
  FieldMappingStatus
} from '../../types/import';

interface FieldMappingTableProps {
  mappings: FieldMappingItem[];
  onRemap: (oldKey: string, newKey: string, customValue?: any) => void;
  onIgnore: (oldKey: string) => void;
  onEditValue: (oldKey: string, newValue: any) => void;
}

export function FieldMappingTable({
  mappings,
  onRemap,
  onIgnore,
  onEditValue
}: FieldMappingTableProps) {
  const [filter, setFilter] = useState<'all' | 'unknown' | 'legacy_products' | 'migrated' | 'transformed' | 'ignored'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingVal, setEditingVal] = useState<string>('');

  const unknownCount = mappings.filter(m => (m.isUnknown || m.status === 'needs_review') && !m.isLegacyProductField).length;
  const legacyProductCount = mappings.filter(m => m.isLegacyProductField).length;
  const migratedCount = mappings.filter(m => m.status === 'migrated').length;
  const transformedCount = mappings.filter(m => m.status === 'transformed').length;
  const ignoredCount = mappings.filter(m => m.status === 'ignored').length;

  const filteredMappings = mappings.filter(m => {
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchKey = m.oldKey.toLowerCase().includes(q) || m.newKey.toLowerCase().includes(q);
      const matchVal = String(m.currentValue ?? '').toLowerCase().includes(q);
      const matchGroup = String(m.legacyGroup ?? '').toLowerCase().includes(q);
      if (!matchKey && !matchVal && !matchGroup) return false;
    }

    // Filter tab
    if (filter === 'unknown') return (m.isUnknown || m.status === 'needs_review') && !m.isLegacyProductField;
    if (filter === 'legacy_products') return m.isLegacyProductField;
    if (filter === 'migrated') return m.status === 'migrated';
    if (filter === 'transformed') return m.status === 'transformed';
    if (filter === 'ignored') return m.status === 'ignored';
    return true;
  });

  const handleStartEdit = (item: FieldMappingItem) => {
    setEditingKey(item.oldKey);
    setEditingVal(typeof item.currentValue === 'object' ? JSON.stringify(item.currentValue) : String(item.currentValue ?? ''));
  };

  const handleSaveEdit = (oldKey: string) => {
    let finalVal: any = editingVal;
    try {
      if ((editingVal.startsWith('{') && editingVal.endsWith('}')) || (editingVal.startsWith('[') && editingVal.endsWith(']'))) {
        finalVal = JSON.parse(editingVal);
      }
    } catch {
      // keep as string
    }
    onEditValue(oldKey, finalVal);
    setEditingKey(null);
  };

  return (
    <div className="bg-white border border-[#99BFF9]/35 rounded-xl p-5 shadow-2xs space-y-4">
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <h4 className="font-serif-display text-base font-medium text-[#1E232B] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#2A548E]" />
            <span>Front Matter Schema Mapping Editor</span>
          </h4>
          <p className="text-xs text-[#5A6270] mt-0.5">
            Review how old Markdown front matter fields map to the new schema. Remap fields, choose "Ignore", or edit values.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fields or values..."
            className="pl-8 pr-3 py-1.5 bg-[#FAF9F6] border border-stone-200 rounded-lg text-xs text-[#1E232B] focus:bg-white focus:outline-none w-52"
          />
        </div>
      </div>

      {/* Prominent Unknown Fields Callout if any exist */}
      {unknownCount > 0 && filter !== 'unknown' && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{unknownCount} unknown field{unknownCount > 1 ? 's' : ''} require review:</strong> The new CMS schema does not have direct equivalents.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFilter('unknown')}
            className="px-2.5 py-1 bg-amber-600 text-white font-semibold text-[11px] rounded hover:bg-amber-700 transition-colors cursor-pointer"
          >
            Review Unknown Fields
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
            filter === 'all'
              ? 'bg-[#2A548E] text-white shadow-2xs'
              : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
          }`}
        >
          All Fields ({mappings.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter('unknown')}
          className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors flex items-center gap-1 ${
            filter === 'unknown'
              ? 'bg-amber-600 text-white shadow-2xs'
              : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
          }`}
        >
          <span>Unknown Fields</span>
          {unknownCount > 0 && (
            <span className={`text-[10px] px-1.5 rounded-full font-bold ${
              filter === 'unknown' ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-900'
            }`}>
              {unknownCount}
            </span>
          )}
        </button>

        {legacyProductCount > 0 && (
          <button
            type="button"
            onClick={() => setFilter('legacy_products')}
            className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors flex items-center gap-1 ${
              filter === 'legacy_products'
                ? 'bg-purple-700 text-white shadow-2xs'
                : 'bg-purple-100 text-purple-900 hover:bg-purple-200'
            }`}
          >
            <span>Legacy Products ({legacyProductCount})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setFilter('migrated')}
          className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
            filter === 'migrated'
              ? 'bg-[#226E56] text-white shadow-2xs'
              : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
          }`}
        >
          Migrated ({migratedCount})
        </button>

        <button
          type="button"
          onClick={() => setFilter('transformed')}
          className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
            filter === 'transformed'
              ? 'bg-purple-700 text-white shadow-2xs'
              : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
          }`}
        >
          Transformed ({transformedCount})
        </button>

        <button
          type="button"
          onClick={() => setFilter('ignored')}
          className={`px-3 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
            filter === 'ignored'
              ? 'bg-stone-600 text-white shadow-2xs'
              : 'bg-stone-100 text-[#5A6270] hover:bg-stone-200'
          }`}
        >
          Ignored ({ignoredCount})
        </button>
      </div>

      {/* Main Field Mapping Table */}
      <div className="overflow-x-auto border border-stone-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#FAF9F6] text-[#5A6270] border-b border-stone-200 font-mono-code text-[11px]">
            <tr>
              <th className="py-2.5 px-3 w-40">Old Field</th>
              <th className="py-2.5 px-3 w-56">Destination CMS Field</th>
              <th className="py-2.5 px-3 w-28">Status</th>
              <th className="py-2.5 px-3">Resolved Value</th>
              <th className="py-2.5 px-3 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredMappings.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#5A6270] italic">
                  No fields match the selected filter or search query.
                </td>
              </tr>
            ) : (
              filteredMappings.map((item, idx) => {
                const isEditing = editingKey === item.oldKey;
                const isIgnored = item.status === 'ignored' || item.newKey === '(ignore)';
                const isUnknown = (item.isUnknown || item.status === 'needs_review') && !item.isLegacyProductField;

                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${
                      item.isLegacyProductField
                        ? 'bg-purple-50/30 hover:bg-purple-50/60'
                        : isUnknown
                        ? 'bg-amber-50/40 hover:bg-amber-50/70'
                        : isIgnored
                        ? 'bg-stone-50/60 opacity-75 hover:opacity-100'
                        : 'hover:bg-stone-50/80'
                    }`}
                  >
                    {/* 1. Old Field */}
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-mono-code font-bold text-[#1E232B] flex items-center gap-1.5 flex-wrap">
                        <span>{item.oldKey}</span>
                        {item.isLegacyProductField && (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded font-sans font-bold">
                            Legacy Product Field
                          </span>
                        )}
                        {isUnknown && !item.isLegacyProductField && (
                          <span className="text-[9px] uppercase px-1 py-0.2 bg-amber-200 text-amber-900 rounded font-sans font-bold">
                            Unknown
                          </span>
                        )}
                      </div>
                      {item.legacyGroup && (
                        <div className="text-[11px] text-purple-800 font-semibold mt-0.5 font-sans">
                          Grouped under: <strong>{item.legacyGroup}</strong>
                        </div>
                      )}
                      {item.isModified && (
                        <span className="text-[10px] text-amber-700 font-medium block mt-0.5">
                          • Manually modified
                        </span>
                      )}
                    </td>

                    {/* 2. Destination Field Dropdown */}
                    <td className="py-2.5 px-3 align-top">
                      <select
                        value={item.newKey}
                        onChange={(e) => onRemap(item.oldKey, e.target.value)}
                        className={`w-full px-2 py-1 border rounded text-xs font-mono font-medium focus:outline-none cursor-pointer ${
                          item.newKey === '(review)'
                            ? 'bg-amber-100 border-amber-300 text-amber-900 font-bold'
                            : item.newKey === '(ignore)'
                            ? 'bg-stone-100 border-stone-300 text-stone-600'
                            : item.isLegacyProductField
                            ? 'bg-purple-50 border-purple-300 text-purple-950 font-bold'
                            : 'bg-white border-[#99BFF9]/50 text-[#2A548E] font-bold'
                        }`}
                      >
                        {item.newKey === '(review)' && (
                          <option value="(review)">[ Needs Review / Unresolved ]</option>
                        )}
                        <optgroup label="Actions &amp; Decisions">
                          <option value="(ignore)">🚫 Ignore this field (Do not migrate)</option>
                          <option value="(custom)">📦 Keep as Custom Front Matter</option>
                          <option value="(review)">❓ Needs Review</option>
                        </optgroup>

                        {/* Grouped Canonical Fields */}
                        {['Legacy Product Record', 'Titles & SEO', 'Core Metadata', 'Dates', 'Visual Media', 'Editorial Content', 'Guide Structure'].map(grp => (
                          <optgroup key={grp} label={grp}>
                            {CANONICAL_DESTINATION_FIELDS.filter(f => f.group === grp).map(f => (
                              <option key={f.key} value={f.key}>
                                → {f.label}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {item.editorialNote && (
                        <div className="text-[10px] text-[#5A6270] mt-1 leading-snug">
                          {item.editorialNote}
                        </div>
                      )}
                    </td>

                    {/* 3. Status Badge */}
                    <td className="py-2.5 px-3 align-top">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.status === 'migrated'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'transformed'
                          ? 'bg-purple-100 text-purple-800'
                          : item.status === 'ignored'
                          ? 'bg-stone-200 text-stone-700'
                          : item.status === 'custom'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.status === 'migrated'
                          ? 'MIGRATE'
                          : item.status === 'transformed'
                          ? 'TRANSFORM'
                          : item.status === 'needs_review'
                          ? 'Needs Review'
                          : item.status.toUpperCase()}
                      </span>
                    </td>

                    {/* 4. Resolved Value / Editor */}
                    <td className="py-2.5 px-3 align-top">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editingVal}
                            onChange={(e) => setEditingVal(e.target.value)}
                            className="w-full px-2 py-1 bg-white border border-[#2A548E] rounded text-xs font-mono text-[#1E232B] focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(item.oldKey)}
                            className="p-1 bg-[#2A548E] text-white rounded hover:bg-[#1B365D] cursor-pointer"
                            title="Save value"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="p-1 bg-stone-200 text-stone-700 rounded hover:bg-stone-300 cursor-pointer"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className={`font-mono text-xs text-[#1E232B] break-all line-clamp-2 ${isIgnored ? 'line-through text-stone-400' : ''}`}>
                            {typeof item.currentValue === 'object'
                              ? JSON.stringify(item.currentValue)
                              : String(item.currentValue ?? '(empty)')}
                          </div>
                          {item.oldValue !== undefined && item.oldValue !== item.currentValue && (
                            <div className="text-[10px] text-stone-500">
                              <span className="font-semibold">Source:</span> {typeof item.oldValue === 'object' ? JSON.stringify(item.oldValue) : String(item.oldValue)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 5. Row Quick Actions */}
                    <td className="py-2.5 px-3 align-top text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="p-1 text-stone-500 hover:text-[#2A548E] hover:bg-stone-100 rounded cursor-pointer"
                            title="Edit value"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}

                        {!isIgnored && (
                          <button
                            type="button"
                            onClick={() => onIgnore(item.oldKey)}
                            className="px-2 py-0.5 text-[11px] font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 rounded cursor-pointer"
                            title="Ignore this field (do not migrate)"
                          >
                            Ignore
                          </button>
                        )}

                        {isIgnored && item.oldKey !== '(missing)' && (
                          <button
                            type="button"
                            onClick={() => onRemap(item.oldKey, item.oldKey)}
                            className="px-2 py-0.5 text-[11px] font-medium text-[#2A548E] hover:bg-[#EEF5FF] border border-[#99BFF9]/40 rounded cursor-pointer"
                            title="Unignore"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
