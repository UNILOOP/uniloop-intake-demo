import React, { useContext, useEffect } from 'react';
import type {
  BlockData,
  BlockDefinition,
  BlockRendererProps,
  ContentBlockItemProps,
  ThemeDefinition,
} from '@/packages/survey-form-package/src/types';
import { Input } from '@/packages/survey-form-package/src/components/ui/input';
import { Label } from '@/packages/survey-form-package/src/components/ui/label';
import { Textarea } from '@/packages/survey-form-package/src/components/ui/textarea';
import { Card } from '@/packages/survey-form-package/src/components/ui/card';
import { CurrentBlock } from '@/packages/survey-form-package/src';
import { SurveyFormContext } from '@/packages/survey-form-package/src/context/SurveyFormContext';
import { themes } from '@/packages/survey-form-package/src/themes';
import { cn } from '@/packages/survey-form-package/src/lib/utils';
import { Rows3 } from 'lucide-react';

/**
 * Question group: several questions of the same form on one screen. The questions stay ordinary
 * blocks in the form, each saving its own answer under its own field name, so the answers the
 * medical record receives don't change. The group lists them by field name and draws each with
 * its own block, hiding any whose visibility rule is false (a text box shown on "Yes").
 *
 * The group never saves an answer of its own. Its field name is only there so core checks it on
 * Continue: it then reports the first missing or invalid answer among its visible questions.
 * Routing belongs on the group, whose rules can test any of its questions. Nothing should lead to
 * the grouped questions themselves, so the flow never stops on them one by one.
 *
 * Each question is drawn by core's CurrentBlock, as a layout draws a step, under a copy of the
 * form's context where that question is the current and only block. The copy also stops the
 * question from moving the screen on by itself (auto-continue, or the sign-up blocks' skip for a
 * known patient): Continue belongs to the group.
 *
 * Small questions draw every question and field label at body size and hide the questions' own
 * screen headings (the sign-up blocks have them), as in the designs' merged screens. Full-size
 * questions keep each question's heading.
 */

type QuestionSize = 'small' | 'heading';

/** Core's generateFieldName, which the portal's core build doesn't export */
const generateFieldName = (prefix: string) =>
  `${prefix}${Date.now().toString(36).substring(4, 7)}${Math.random().toString(36).substring(2, 5)}`;

const getQuestions = (data: BlockData): string[] =>
  Array.isArray(data.questions) ? data.questions.filter((name: unknown) => typeof name === 'string' && name) : [];

const getSize = (data: BlockData): QuestionSize => (data.questionSize === 'heading' ? 'heading' : 'small');

// A block's problem is a message, or one message per field (the contact block's); compared as text
type Problem = string | Record<string, string>;
const problemKey = (problem: unknown) =>
  !problem ? '' : typeof problem === 'string' ? problem : JSON.stringify(problem);

const hasAnswer = (value: unknown) =>
  value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && value.length === 0);

/** A colour at a given strength, without a colour literal in the source */
const tint = (color: string, percent: number) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// The first problem among each group's visible questions, by the group's uuid, as of its last
// render. Core checks a block on Continue with its own value only, which a group doesn't have;
// the group renders with every answer, so it leaves its verdict here for validateValue to read.
const groupProblems = new Map<string, Problem | null>();

// The portal's block build binds the name SurveyFormContext to a namespace holding the context
// (with useSurveyForm and SurveyFormProvider), where the demo binds it to the context itself
const FormContext: typeof SurveyFormContext =
  (SurveyFormContext as unknown as { SurveyFormContext?: typeof SurveyFormContext }).SurveyFormContext ??
  SurveyFormContext;

// Grouped questions take the group's full width (the date of birth block centres itself in a
// narrower column on its own screen). Small questions also get body-size labels and lose their
// own screen headings.
const GROUP_CSS = `
[data-question-group-size] .max-w-sm { max-width: none !important; }
[data-question-group-size="small"] label {
  font-size: 15px !important; line-height: 1.4 !important; font-weight: 500 !important; letter-spacing: 0 !important;
}
[data-question-group-size="small"] h2, [data-question-group-size="small"] h3,
[data-question-group-size="small"] h2 + p, [data-question-group-size="small"] h3 + p { display: none !important; }
`;

const QuestionGroupRenderer = React.forwardRef<HTMLDivElement, BlockRendererProps>(
  ({ block, error, theme: themeProp }, ref) => {
    const theme: ThemeDefinition = themeProp ?? themes.default;
    const form = useContext(FormContext);
    const { values, setValue, errors, surveyData, getVisibleBlocks, validateField } = form;
    const size = getSize(block);

    // The listed questions, in the group's order, found anywhere in the form
    const allBlocks: BlockData[] = [];
    const collect = (items?: BlockData[]) =>
      items?.forEach((item) => {
        allBlocks.push(item);
        collect(item.items);
      });
    collect(surveyData?.rootNode?.items);
    surveyData?.rootNode?.nodes?.forEach((node: any) => collect(typeof node === 'string' ? undefined : node.items));
    const questions = getQuestions(block)
      .map((name) => allBlocks.find((item) => item.fieldName === name && item.uuid !== block.uuid))
      .filter((item): item is BlockData => !!item);
    const visible = getVisibleBlocks(questions);

    // Each visible question's problem, from its own block's checks and rules
    const problems: Record<string, Problem> = {};
    visible.forEach((question) => {
      const name = question.fieldName as string;
      const value = values[name];
      const problem: Problem | null =
        (validateField(name, value, values) as Problem | null) ||
        (question.required === true && !hasAnswer(value) ? 'Please answer this question.' : null);
      if (problem) problems[name] = problem;
    });
    const firstProblem = visible.map((question) => problems[question.fieldName as string]).find(Boolean) ?? null;
    if (block.uuid) groupProblems.set(block.uuid, firstProblem);

    // Core turns Continue off while the group has an error, and only re-checks a field when it's
    // set. Once the answers change what's missing, re-check the group by setting its field to
    // nothing (JSON leaves an undefined field out, so no answer is sent for it).
    const errorKey = problemKey(error);
    const firstProblemKey = problemKey(firstProblem);
    useEffect(() => {
      if (errorKey && errorKey !== firstProblemKey && block.fieldName) setValue(block.fieldName, undefined);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [errorKey, firstProblemKey, block.fieldName]);

    return (
      <div ref={ref} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {(block.label || block.description) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {block.label && (
              <h2 className={cn('block text-lg font-bold', theme.field.label, 'text-left')} style={{ margin: 0 }}>
                {block.label}
              </h2>
            )}
            {block.description && (
              <p className={cn('text-sm text-muted-foreground', theme.field.description, 'text-left')} style={{ margin: 0 }}>
                {block.description}
              </p>
            )}
          </div>
        )}

        {block.note && (
          <p
            className={cn('text-sm', theme.field.description)}
            style={{ margin: 0, padding: 16, borderRadius: 12, backgroundColor: theme.colors.accent || tint(theme.colors.primary, 12) }}
          >
            {block.note}
          </p>
        )}

        <style>{GROUP_CSS}</style>
        <div
          data-question-group-size={size}
          style={{ display: 'flex', flexDirection: 'column', gap: size === 'small' ? 28 : 40 }}
        >
          {visible.map((question) => {
            const name = question.fieldName as string;
            const questionContext = {
              ...form,
              surveyData: {
                ...surveyData,
                rootNode: { ...surveyData.rootNode, items: [{ ...question, autoContinueOnSelect: false }], nodes: [] },
              },
              currentPage: 0,
              currentBlockIndex: 0,
              goToNextBlock: () => {},
              // After a Continue that failed, every unanswered question says so. Core types an error
              // as text; the contact block's is its per-field object, passed on as is.
              errors: { ...errors, [name]: ((error ? problems[name] : undefined) || errors[name]) as string },
            };
            return (
              <FormContext.Provider key={question.uuid || name} value={questionContext}>
                <CurrentBlock />
              </FormContext.Provider>
            );
          })}
        </div>

        {typeof error === 'string' && error && !firstProblem && (
          <p className={cn('text-sm text-red-600', theme.field.error)} style={{ margin: 0 }}>
            {error}
          </p>
        )}
      </div>
    );
  },
);

QuestionGroupRenderer.displayName = 'QuestionGroupRenderer';

const QuestionGroupForm: React.FC<ContentBlockItemProps> = ({ data, onUpdate }) => {
  const handleChange = (field: string, value: unknown) => onUpdate?.({ ...data, [field]: value });
  const size = getSize(data);

  const textField = (field: string, label: string, placeholder: string) => (
    <div className="space-y-2">
      <Label className="text-sm" htmlFor={`question-group-${field}`}>
        {label}
      </Label>
      <Input
        id={`question-group-${field}`}
        value={data[field] || ''}
        onChange={(e) => handleChange(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {textField('fieldName', 'Field Name', 'questionGroup1')}
      <p className="text-xs text-muted-foreground">
        Core checks the group under this name on Continue. It never gets an answer of its own.
      </p>
      {textField('label', 'Title (optional)', 'Two quick checks')}
      <div className="space-y-2">
        <Label className="text-sm" htmlFor="question-group-description">
          Description (optional)
        </Label>
        <Textarea
          id="question-group-description"
          value={data.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          rows={2}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sm" htmlFor="question-group-note">
          Note (optional)
        </Label>
        <Textarea
          id="question-group-note"
          value={data.note || ''}
          onChange={(e) => handleChange('note', e.target.value)}
          rows={2}
        />
        <p className="text-xs text-muted-foreground">Shown in a tinted box under the title.</p>
      </div>
      <div className="space-y-2">
        <Label className="text-sm" htmlFor="question-group-questions">
          Questions, by field name, one per line
        </Label>
        <Textarea
          id="question-group-questions"
          value={getQuestions(data).join('\n')}
          onChange={(e) =>
            handleChange(
              'questions',
              e.target.value.split('\n').map((line) => line.trim()),
            )
          }
          rows={5}
          placeholder={'selectableboxoaiso8\nselectableboxsihdz3'}
        />
        <p className="text-xs text-muted-foreground">
          Each question stays a block of its own in the form; give it a visibility rule to show it only after an
          answer. Put the routing on this group, and point nothing at the grouped questions.
        </p>
      </div>
      <div className="space-y-2">
        <Label className="text-sm">Question size</Label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={size === 'small'} onChange={() => handleChange('questionSize', 'small')} />
            Small, under the title
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={size === 'heading'} onChange={() => handleChange('questionSize', 'heading')} />
            Full-size headings
          </label>
        </div>
      </div>
    </div>
  );
};

const QuestionGroupItem: React.FC<ContentBlockItemProps> = ({ data }) => (
  <Card className="p-4">
    <p className="font-medium">{data.label || 'Question group'}</p>
    <p className="text-sm text-muted-foreground">{getQuestions(data).join(', ') || 'No questions yet'}</p>
  </Card>
);

const createDefaultData = (): BlockData => ({
  type: 'questionGroup',
  fieldName: generateFieldName('questionGroup'),
  label: '',
  description: '',
  note: '',
  questions: [],
  questionSize: 'small',
});

export const QuestionGroupBlock: BlockDefinition = {
  type: 'questionGroup',
  name: 'Question Group',
  description: 'Several questions of the form on one screen, each keeping its own answer',
  icon: <Rows3 className="w-4 h-4" />,
  defaultData: createDefaultData(),
  generateDefaultData: createDefaultData,
  renderItem: (props) => <QuestionGroupItem {...props} />,
  renderFormFields: (props) => <QuestionGroupForm {...props} />,
  renderPreview: () => (
    <div className="w-full py-1 text-sm text-muted-foreground">Two or more questions on one screen</div>
  ),
  renderBlock: (props) => <QuestionGroupRenderer {...props} />,
  validate: (data) => {
    if (!data.fieldName) return 'Field name is required';
    if (getQuestions(data).length === 0) return 'List at least one question';
    return null;
  },
  validateValue: (_value, data) => ((data.uuid && groupProblems.get(data.uuid)) || null) as string | null,
  fieldConfig: {
    enabled: true,
    label: 'Field Name',
    required: true,
  },
};

export default QuestionGroupBlock;
