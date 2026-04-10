import { useState, useEffect } from 'react';
import { Save, User, Building2, Sparkles, X, Loader2 } from 'lucide-react';
import { getBrandProfile, saveBrandProfile, suggestBrandProfile, BrandProfile } from '../../api/client';

interface Props { workspaceId: string; }

const defaultProfile: Omit<BrandProfile, 'id' | 'workspace_id'> = {
  publisher_account_id: '',
  profile_mode: 'brand',
  brand_name: '', industry: '', tone_description: '', keywords: '',
  avoid_topics: '', target_audience: '', writing_directions: '',
  example_post: '', posting_notes: '',
  auto_post_mode: 'manual', posts_per_day: 1, agent_enabled: false,
  persona_name: '', occupation: '', personality: '',
  catchphrase: '', lifestyle: '', personal_background: '',
};

export function BrandProfilePage({ workspaceId }: Props) {
  const [profile, setProfile] = useState<Partial<BrandProfile>>(defaultProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI 建議狀態
  const [showSuggest, setShowSuggest] = useState(false);
  const [description, setDescription] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState('');

  useEffect(() => {
    if (!workspaceId) return;
    getBrandProfile(workspaceId)
      .then(res => { if (res.profile) setProfile(res.profile); })
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const set = (key: keyof typeof profile, value: any) =>
    setProfile(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const result = await saveBrandProfile({ ...profile, workspace_id: workspaceId } as any);
      setProfile(result.profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      alert(`儲存失敗: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSuggest = async () => {
    if (!description.trim()) return;
    setSuggesting(true);
    setSuggestError('');
    try {
      const { suggestion } = await suggestBrandProfile(
        description,
        (profile.profile_mode as 'brand' | 'persona') || 'brand'
      );
      // 將 AI 建議合併到目前設定（不覆蓋空值以外的欄位）
      setProfile(prev => ({ ...prev, ...suggestion }));
      setShowSuggest(false);
      setDescription('');
    } catch (e: any) {
      setSuggestError(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  const Field = ({ label, field, type = 'text', placeholder = '', rows = 0 }: {
    label: string; field: keyof BrandProfile; type?: string; placeholder?: string; rows?: number;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">{label}</label>
      {rows > 0 ? (
        <textarea
          value={(profile[field] as string) || ''}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 resize-none"
        />
      ) : (
        <input
          type={type}
          value={(profile[field] as string) || ''}
          onChange={e => set(field, type === 'number' ? parseInt(e.target.value) || 1 : e.target.value)}
          placeholder={placeholder}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
        />
      )}
    </div>
  );

  if (loading) return <div className="p-6 text-center text-gray-500 text-sm">載入中...</div>;

  const isBrand = profile.profile_mode === 'brand';

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-100">品牌設定</h1>
          <p className="text-sm text-gray-500 mt-1">設定 AI 產文時使用的品牌或人設資訊</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSuggest(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-600 text-white rounded-lg text-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI 建議
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
          >
            <Save className="w-4 h-4" />
            {saved ? '已儲存' : saving ? '儲存中...' : '儲存'}
          </button>
        </div>
      </div>

      {/* AI 建議 Panel */}
      {showSuggest && (
        <div className="mb-6 p-4 bg-purple-900/20 border border-purple-700/50 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-medium text-purple-200">AI 一鍵建議</h3>
            </div>
            <button
              onClick={() => { setShowSuggest(false); setDescription(''); setSuggestError(''); }}
              className="text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            簡單描述你的{isBrand ? '品牌' : '個人人設'}，AI 將自動填寫所有設定欄位。
          </p>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={isBrand
              ? '例：我是一個台灣的 AI 工具新創，主打幫助中小企業自動化日常流程，目標客戶是台灣的中小企業主和創業者...'
              : '例：我是一個 30 歲的台灣工程師，平常喜歡分享科技新知和生活日常，語氣輕鬆幽默，偶爾抱怨加班但保持正能量...'
            }
            rows={4}
            className="w-full bg-gray-900 border border-purple-800/50 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-purple-500 resize-none mb-3"
          />
          {suggestError && (
            <p className="text-xs text-red-400 mb-2">{suggestError}</p>
          )}
          <button
            onClick={handleSuggest}
            disabled={suggesting || !description.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-sm transition-colors"
          >
            {suggesting
              ? <><Loader2 className="w-4 h-4 animate-spin" /> AI 分析中...</>
              : <><Sparkles className="w-4 h-4" /> 生成建議</>
            }
          </button>
          <p className="text-xs text-gray-600 mt-2">
            ※ 生成後會填入所有欄位，你可以再手動修改後儲存
          </p>
        </div>
      )}

      {/* Mode Switch */}
      <div className="mb-6 p-4 bg-gray-800 border border-gray-700 rounded-xl">
        <label className="block text-xs font-medium text-gray-400 mb-3">模式選擇</label>
        <div className="flex gap-3">
          {(['brand', 'persona'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => set('profile_mode', mode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors border ${
                profile.profile_mode === mode
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}
            >
              {mode === 'brand' ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
              {mode === 'brand' ? '品牌模式' : '人設模式'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {isBrand ? '適合企業帳號或產品帳號' : '適合個人品牌帳號，以角色身份發文'}
        </p>
      </div>

      <div className="space-y-5">
        {isBrand ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="品牌名稱" field="brand_name" placeholder="例：OmniCo" />
              <Field label="產業類別" field="industry" placeholder="例：科技、電商、餐飲" />
            </div>
            <Field label="語氣風格描述" field="tone_description" placeholder="例：親切、幽默、專業但不失人味" rows={2} />
            <Field label="核心關鍵字（逗號分隔）" field="keywords" placeholder="例：AI, 創業, 效率工具" />
            <Field label="避免話題" field="avoid_topics" placeholder="例：政治爭議、競品攻擊" rows={2} />
            <Field label="目標受眾" field="target_audience" placeholder="例：25-40 歲台灣新創工作者" rows={2} />
            <Field label="寫作方向" field="writing_directions" placeholder="例：側重實用分享，避免自吹自擂" rows={2} />
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="人設姓名" field="persona_name" placeholder="例：阿偉" />
              <Field label="職業" field="occupation" placeholder="例：UI 設計師" />
            </div>
            <Field label="個性描述" field="personality" placeholder="例：容易被數據說服，喜歡理性討論" rows={2} />
            <Field label="口頭禪" field="catchphrase" placeholder="例：說真的...、你知道嗎" />
            <Field label="生活方式" field="lifestyle" placeholder="例：早起運動、喝咖啡看科技新聞" rows={2} />
            <Field label="個人背景故事" field="personal_background" placeholder="例：科技公司出身，後來自己接案" rows={3} />
          </>
        )}

        <Field label="範例貼文（供 AI 學習風格）" field="example_post" placeholder="貼入一則你喜歡的真實貼文風格..." rows={4} />
        <Field label="產文備註（AI 嚴格遵守）" field="posting_notes" placeholder="例：不要提到競品名字；結尾一定要問問題" rows={3} />

        {/* Auto post settings */}
        <div className="p-4 bg-gray-800 border border-gray-700 rounded-xl space-y-4">
          <h3 className="text-sm font-medium text-gray-300">自動發文設定</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">發文模式</label>
              <select
                value={profile.auto_post_mode || 'manual'}
                onChange={e => set('auto_post_mode', e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="manual">手動審核</option>
                <option value="auto">自動發布</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">每日發文篇數</label>
              <input
                type="number"
                min={1} max={20}
                value={profile.posts_per_day || 1}
                onChange={e => set('posts_per_day', parseInt(e.target.value) || 1)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => set('agent_enabled', !profile.agent_enabled)}
              className={`relative w-10 h-5 rounded-full transition-colors ${profile.agent_enabled ? 'bg-indigo-600' : 'bg-gray-600'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${profile.agent_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm text-gray-300">啟用 AI Agent 自動排程</span>
          </div>
        </div>
      </div>
    </div>
  );
}
