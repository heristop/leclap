import { useTranslation } from 'react-i18next';
import { Proportions } from '@/presentation/components/icons';
import { TemplateForm } from '@/presentation/components/TemplateForm';
import { StepClip } from '@/presentation/components/builder/StepClip';
import { MediaPicker } from '@/presentation/components/admin/MediaPicker';
import { SegmentedControl } from '@/presentation/components/ui';
import type { Template, InputSection, QualityTier } from '@/services/templateService';
import type { VideoEdit } from '@/domain/valueObjects/videoEdits';
import type { MediaChoice } from '@/presentation/components/admin/templateEditorModel';
import { buildDescriptionVars } from '@/lib/i18nText';
import type { SceneModel } from './sceneStatus';

type Orientation = 'portrait' | 'landscape' | 'square';

const aspectClass = (orientation: Orientation): string => {
  if (orientation === 'portrait') return 'aspect-[9/16]';

  if (orientation === 'square') return 'aspect-square';

  return 'aspect-video';
};

const orientationOf = (template: Template): Orientation => {
  const o = template.descriptor.global?.orientation;

  return o === 'portrait' || o === 'square' ? o : 'landscape';
};

interface ScenePanelProps {
  template: Template;
  section: InputSection;
  model: SceneModel;
  clipCount: number;
  onFormDataChange: (d: Record<string, string>) => void;
  onClipChange: (sectionName: string, file: File | undefined) => void;
  onAddRush: (sectionName: string, file: File) => void;
  onSelectRush: (sectionName: string, file: File) => void;
  onRemoveRush: (sectionName: string, file: File) => void;
  onEditChange: (sectionName: string, edit: VideoEdit | undefined) => void;
}

// The editor for the currently-selected scene: its form fields, or its clip recorder/upload. Reuses
// the same layout-agnostic step components the linear flow uses (chrome stripped — the shell frames it).
export const ScenePanel = ({
  template,
  section,
  model,
  clipCount,
  onFormDataChange,
  onClipChange,
  onAddRush,
  onSelectRush,
  onRemoveRush,
  onEditChange,
}: ScenePanelProps) => {
  if (section.kind === 'form') {
    return (
      <TemplateForm
        template={template}
        sectionName={section.name}
        formData={model.formData}
        onFormDataChange={onFormDataChange}
      />
    );
  }

  const descriptorSection = (template.descriptor.sections ?? []).find((s) => s.name === section.name);

  if (!descriptorSection) return null;

  const vars = buildDescriptionVars(template.descriptor.global?.variables, model.formData);

  return (
    <StepClip
      chrome={false}
      showEditor={false}
      orientation={orientationOf(template)}
      section={descriptorSection}
      vars={vars}
      clipNumber={section.clipIndex + 1}
      totalClips={clipCount}
      file={model.clipsBySection[section.name]}
      onFileChange={(file) => {
        onClipChange(section.name, file);
      }}
      rushes={model.rushesBySection[section.name] ?? []}
      selectedRush={model.clipsBySection[section.name]}
      onAddRush={(file) => {
        onAddRush(section.name, file);
      }}
      onSelectRush={(file) => {
        onSelectRush(section.name, file);
      }}
      onRemoveRush={(file) => {
        onRemoveRush(section.name, file);
      }}
      edit={model.editsBySection[section.name]}
      onEditChange={(edit) => {
        onEditChange(section.name, edit);
      }}
    />
  );
};

interface MediaToolPanelProps {
  template: Template;
  model: SceneModel;
  onMusicChange: (c: MediaChoice | null) => void;
  onBackgroundChange: (c: MediaChoice | null) => void;
}

// Music + background pickers, each shown only when the template offers it.
export const MediaToolPanel = ({ template, model, onMusicChange, onBackgroundChange }: MediaToolPanelProps) => {
  const { t } = useTranslation('builder');
  const g = template.descriptor.global ?? {};
  const showMusic = (g.allowedMusic?.length ?? 0) > 0 || Boolean(g.allowUploadMusic);
  const showBackground = (g.allowedBackgrounds?.length ?? 0) > 0 || Boolean(g.allowUploadBackground);

  return (
    <div className="space-y-6">
      {showMusic && (
        <div>
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">{t('stepMedia.music')}</h3>
          <MediaPicker
            kind="music"
            value={model.musicChoice}
            onChange={onMusicChange}
            allowedIds={g.allowedMusic}
            allowUpload={Boolean(g.allowUploadMusic)}
          />
        </div>
      )}
      {showBackground && (
        <div>
          <h3 className="mb-3 font-display text-base font-semibold text-foreground">{t('stepMedia.background')}</h3>
          <MediaPicker
            kind="picture"
            value={model.backgroundChoice}
            onChange={onBackgroundChange}
            allowedIds={g.allowedBackgrounds}
            allowUpload={Boolean(g.allowUploadBackground)}
          />
        </div>
      )}
    </div>
  );
};

const QUALITY_TIERS: QualityTier[] = ['draft', 'standard', 'high'];

interface FormatPanelProps {
  template: Template;
  qualityTier: QualityTier;
  onQualityTierChange: (tier: QualityTier) => void;
}

// The output settings. The frame is the template's (an authoring decision, so it reads as a fact, not a
// control); the render quality is the viewer's. From `sm` up the quality switch lives in the titlebar,
// so here it only shows on phones — which otherwise had no way to pick it at all.
export const FormatPanel = ({ template, qualityTier, onQualityTierChange }: FormatPanelProps) => {
  const { t } = useTranslation('builder');
  const orientation = orientationOf(template);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 rounded-xl border border-foreground/10 bg-surface/50 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-500/10 text-brand-500">
          <Proportions className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{t(`stepMedia.aspect.${orientation}`)}</p>
          <p className="text-xs text-gray-400">{t('stepMedia.formatNote')}</p>
        </div>
      </div>

      <div className="space-y-2 sm:hidden">
        <p className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t('hub.quality.label')}
        </p>
        <SegmentedControl
          ariaLabel={t('hub.quality.label')}
          value={qualityTier}
          onChange={(next) => {
            onQualityTierChange(next as QualityTier);
          }}
          options={QUALITY_TIERS.map((tier) => ({ value: tier, label: t(`hub.quality.${tier}`) }))}
          classNames={{ track: 'flex w-full', button: 'flex-1 min-h-11' }}
        />
        <p className="text-xs leading-relaxed text-gray-400">{t(`hub.quality.hint.${qualityTier}`)}</p>
      </div>
    </div>
  );
};

export { aspectClass, orientationOf };
export type { Orientation };
