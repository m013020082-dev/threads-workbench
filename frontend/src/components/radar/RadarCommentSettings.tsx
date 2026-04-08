import { useState } from 'react';
import { MessageSquare, ChevronDown, ChevronRight, Eye } from 'lucide-react';

export interface CommentSettings {
  followPhrase: string;
  selfPromo: string;
}

interface Props {
  settings: CommentSettings;
  onChange: (s: CommentSettings) => void;
}

export function RadarCommentSettings({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const composed = [settings.followPhrase, settings.selfPromo].filter(Boolean).join('\n');

  return (
    <div className="mb-3 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header toggle */}
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-gray-800 hover:bg-gray-750 text-left transition-colors"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
          <MessageSquare className="w-3.5 h-3.5 text-green-400" />
          留言格式設定
        </span>
        {open ? <ChevronDown className="w-3.5 h-3.5 text-gray-500" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-500" />}
      </button>

      {open && (
        <div className="px-3 pb-3 pt-2.5 space-y-2.5 bg-gray-900">
          {/* 已追短語 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">已追短語</label>
            <input
              type="text"
              value={settings.followPhrase}
              onChange={e => onChange({ ...settings, followPhrase: e.target.value })}
              placeholder="例：已追！、剛追你了 👋、已追回！"
              className="w-full px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-600"
            />
          </div>

          {/* 自我廣告文 */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">自我廣告文</label>
            <textarea
              rows={3}
              value={settings.selfPromo}
              onChange={e => onChange({ ...settings, selfPromo: e.target.value })}
              placeholder="例：我是做室內設計的，歡迎來逛逛我的主頁 🏠"
              className="w-full px-2.5 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-green-600 resize-none leading-relaxed"
            />
          </div>

          {/* Preview */}
          <button
            onClick={() => setShowPreview(p => !p)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <Eye className="w-3 h-3" />
            {showPreview ? '收起預覽' : '預覽留言'}
          </button>
          {showPreview && (
            <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 whitespace-pre-wrap leading-relaxed min-h-[2.5rem]">
              {composed || <span className="text-gray-600 italic">（尚未設定留言格式）</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
