import { useState, useEffect } from 'react';
import { SubtitleStyle, SubtitleTemplate } from '../../types/subtitle';
import { PRESET_TEMPLATES, CATEGORY_OPTIONS } from '../../data/subtitleTemplates';

interface TemplateGalleryProps {
  currentStyle: SubtitleStyle;
  onTemplateSelect: (style: SubtitleStyle) => void;
  lockFont: boolean;
  lockPosition: boolean;
  onLockFontChange: (locked: boolean) => void;
  onLockPositionChange: (locked: boolean) => void;
}

export default function TemplateGallery({
  currentStyle,
  onTemplateSelect,
  lockFont,
  lockPosition,
  onLockFontChange,
  onLockPositionChange,
}: TemplateGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [customTemplates, setCustomTemplates] = useState<SubtitleTemplate[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Load from localStorage
  useEffect(() => {
    const savedCustom = localStorage.getItem('custom_subtitle_templates');
    if (savedCustom) {
      setCustomTemplates(JSON.parse(savedCustom));
    }
    const savedFavorites = localStorage.getItem('favorite_subtitle_templates');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, []);

  const allTemplates = [...PRESET_TEMPLATES, ...customTemplates];

  const filteredTemplates = allTemplates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === 'all' ||
      (selectedCategory === 'favorite' && favorites.has(template.id)) ||
      template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTemplateClick = (template: SubtitleTemplate) => {
    let newStyle = { ...template.style };

    if (lockFont) {
      newStyle.fontFamily = currentStyle.fontFamily;
      newStyle.fontSize = currentStyle.fontSize;
      newStyle.letterSpacing = currentStyle.letterSpacing;
      newStyle.lineHeight = currentStyle.lineHeight;
    }

    if (lockPosition) {
      newStyle.position = currentStyle.position;
    }

    onTemplateSelect(newStyle);
  };

  const toggleFavorite = (templateId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(templateId)) {
      newFavorites.delete(templateId);
    } else {
      newFavorites.add(templateId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('favorite_subtitle_templates', JSON.stringify([...newFavorites]));
  };

  const saveCustomTemplate = () => {
    if (!newTemplateName.trim()) return;

    const newTemplate: SubtitleTemplate = {
      id: `custom-${Date.now()}`,
      name: newTemplateName,
      category: 'custom',
      style: currentStyle,
    };

    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    localStorage.setItem('custom_subtitle_templates', JSON.stringify(updated));
    setNewTemplateName('');
    setShowSaveModal(false);
  };

  const deleteCustomTemplate = (templateId: string) => {
    const updated = customTemplates.filter((t) => t.id !== templateId);
    setCustomTemplates(updated);
    localStorage.setItem('custom_subtitle_templates', JSON.stringify(updated));
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
            텍스트 템플릿 ({filteredTemplates.length}개)
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onLockFontChange(!lockFont)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                lockFont
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              폰트 고정
            </button>
            <button
              onClick={() => onLockPositionChange(!lockPosition)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                lockPosition
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              위치 고정
            </button>
            <button
              onClick={() => setShowSaveModal(true)}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors"
            >
              내 템플릿 저장
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="템플릿 이름 검색..."
            className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Template Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="group relative bg-slate-800 dark:bg-slate-900 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                onClick={() => handleTemplateClick(template)}
              >
                {/* Template Preview */}
                <div className="aspect-video flex items-center justify-center p-4">
                  <div className="relative inline-block">
                    {template.style.background.enabled && (
                      <div
                        className="absolute inset-0 -m-2"
                        style={{
                          backgroundColor: template.style.background.color,
                          opacity: template.style.background.opacity,
                          borderRadius: `${template.style.background.borderRadius}px`,
                        }}
                      />
                    )}
                    <p
                      className="relative text-center"
                      style={{
                        fontFamily: template.style.fontFamily,
                        fontSize: '14px',
                        color: template.style.color,
                        WebkitTextStroke: template.style.stroke.enabled
                          ? `${Math.max(1, template.style.stroke.width / 2)}px ${template.style.stroke.color}`
                          : undefined,
                        textShadow: template.style.shadow.enabled
                          ? `${template.style.shadow.x / 2}px ${template.style.shadow.y / 2}px ${template.style.shadow.blur / 2}px ${template.style.shadow.color}`
                          : undefined,
                      }}
                    >
                      {template.name}
                    </p>
                  </div>
                </div>

                {/* Favorite & Delete */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(template.id);
                    }}
                    className="w-7 h-7 bg-slate-900 bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all"
                  >
                    <span className="text-base">{favorites.has(template.id) ? '⭐' : '☆'}</span>
                  </button>
                  {template.category === 'custom' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('이 템플릿을 삭제하시겠습니까?')) {
                          deleteCustomTemplate(template.id);
                        }
                      }}
                      className="w-7 h-7 bg-red-600 bg-opacity-80 rounded-full flex items-center justify-center hover:bg-opacity-100 transition-all"
                    >
                      <span className="text-white text-sm">✕</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              검색 결과가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">
              템플릿 저장
            </h3>
            <input
              type="text"
              value={newTemplateName}
              onChange={(e) => setNewTemplateName(e.target.value)}
              placeholder="템플릿 이름 입력..."
              className="w-full px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              onKeyPress={(e) => e.key === 'Enter' && saveCustomTemplate()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveCustomTemplate}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
