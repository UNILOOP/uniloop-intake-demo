# React Survey Builder

A comprehensive React-based survey builder and renderer ecosystem featuring a powerful visual drag-and-drop interface for creating dynamic, interactive surveys and forms with advanced conditional logic, multiple layout options, and extensive customization capabilities.

## 🚀 Features

### **Visual Survey Builder**
- **Drag-and-Drop Interface**: Intuitive visual editor with real-time preview
- **18+ Unified Block Types**: Text inputs, radio buttons, checkboxes, file uploads, matrices, date pickers, and more
- **Unified Block System**: Single-file block definitions combining builder and renderer components
- **Custom Block Support**: Easily extend with your own unified block definitions using `registerBlock()`
- **Node-Based Architecture**: Hierarchical survey structure with sections and pages
- **Live Preview**: See your survey as you build it

### **Advanced Logic & Conditional Features**
- **Conditional Logic**: Show/hide blocks based on user responses with complex condition rules
- **Navigation Rules**: Custom routing between survey sections based on user input
- **Calculated Fields**: Dynamic field calculations and computed values
- **Branching Logic**: Smart survey flow with condition-based page navigation
- **BMI Calculator**: Built-in health calculators and custom computation blocks
- **Validation Rules**: Field-level validation with custom error messages

### **Multiple Layout Options**
- **Page-by-Page**: Traditional multi-page survey experience
- **Continuous Scroll**: Single-page scrollable layout
- **Accordion**: Collapsible sections for better organization
- **Tabs**: Tabbed interface for easy navigation
- **Stepper**: Step-by-step progression with visual indicators
- **Full Page**: Immersive full-screen survey experience

### **Comprehensive Theming System**
- **7 Built-in Themes**: Default, Minimal, Colorful, Modern, Corporate, Dark, and Custom
- **Complete Customization**: Control every aspect of styling from colors to typography
- **Dark Mode Support**: Built-in dark/light mode toggle
- **Responsive Design**: Mobile-first approach with touch-friendly interactions
- **CSS-in-JS**: Tailwind CSS integration with theme variables

### **Mobile-First Experience**
- **Swipe Navigation**: Touch gestures for mobile navigation
- **Responsive Layouts**: Optimized for all screen sizes
- **Mobile-Specific Controls**: Touch-friendly buttons and interactions
- **Progressive Web App**: Offline capability and app-like experience

### **Developer-Friendly**
- **TypeScript Support**: Full type safety and IntelliSense
- **Workspace Architecture**: Monorepo with separate builder and renderer packages
- **Unified Block System**: Single-file block definitions with `renderBlock` for unified rendering
- **Block Registry**: Global block registration with `registerBlock()` and `getBlockDefinition()`
- **Extensible Architecture**: Easy to add custom block types with full builder/renderer support
- **Theme System**: Comprehensive theming with CSS variables
- **Modern Stack**: React 19, Next.js 15, Tailwind CSS 4

## 🏗️ Architecture

This project follows a **monorepo structure** with two main components:

### **Main Application** (`/src/app/`)
- **Builder Interface** (`/builder/`) - Visual survey creation with drag-and-drop
- **Demo Interface** (`/demo/`) - Interactive survey renderer with JSON upload
- **Landing Page** (`/`) - Project overview and sample survey demonstration

### **Survey Form Package** (`/src/packages/survey-form-package/`)
- **Builder Components** (`/src/builder/`) - Visual survey creation interface
- **Renderer Components** (`/src/renderer/`) - Survey form rendering engine
- **Block Definitions** (`/src/builder/blocks/`) - Individual form element types
- **Layout System** (`/src/renderer/layouts/`) - Different survey presentation modes
- **Theme Engine** (`/src/themes/`) - Comprehensive styling system

## 🎯 Block Types

The survey builder includes 18+ predefined block types:

### **Input Blocks**
- **Text Input**: Single-line text fields with validation
- **Textarea**: Multi-line text areas
- **Select Dropdown**: Single and multi-select dropdowns
- **Radio Buttons**: Single-choice selection
- **Checkboxes**: Multiple-choice selection
- **Selectable Boxes**: Visual selection cards with auto-continue
- **Range Slider**: Numeric range selection
- **Date Picker**: Date/time selection with calendar
- **File Upload**: File attachment with type validation

### **Advanced Blocks**
- **Matrix**: Grid-based questions (Likert scales, rating matrices)
- **Conditional**: Dynamic blocks that appear based on logic
- **Calculated Field**: Computed values based on other responses
- **BMI Calculator**: Health assessment with automatic BMI calculation
- **Checkout**: Contact information and payment collection
- **Authentication**: User login/registration forms

### **Content Blocks**
- **HTML**: Rich content with custom HTML
- **Markdown**: Formatted text with Markdown support
- **Script**: Custom JavaScript execution

## 🎨 Theming System

Comprehensive theming with 7 built-in themes:

```typescript
// Available themes
type SurveyTheme = 
  | "default"     // Clean, professional gray theme
  | "minimal"     // Simplified, typography-focused
  | "colorful"    // Vibrant, engaging colors
  | "modern"      // Contemporary design with gradients
  | "corporate"   // Professional business theme
  | "dark"        // Dark mode optimized
  | "custom";     // Fully customizable
```

Each theme controls:
- **Colors**: Primary, secondary, accent, background, text, borders
- **Typography**: Font sizes, weights, line heights
- **Spacing**: Margins, padding, component sizing
- **Components**: Buttons, inputs, cards, progress bars
- **Animations**: Transitions and interactive effects

## 🚀 Getting Started

### **Prerequisites**
- Node.js 18+ 
- npm, yarn, or bun package manager

### **Installation**

1. **Clone the repository**
```bash
git clone https://github.com/UNISELL-DEV/react-survey-builder.git
cd react-survey-builder
```

2. **Install dependencies**
```bash
bun install
```

3. **Start the development server**
```bash
bun dev
```

4. **Open your browser**
Navigate to [http://localhost:3000](http://localhost:3000)

### **Development Commands**

#### Main Application
```bash
bun run dev      # Start development server with Turbopack
bun run build    # Build the application
bun run start    # Start production server
bun run lint     # Run Next.js linting
```

#### Survey Form Package
```bash
cd src/packages/survey-form-package
bun run build    # Build the package using tsup
bun run dev      # Build package in watch mode
bun run lint     # Run Biome linting
```

## 📖 Usage Examples

### **Basic Survey Renderer**

```typescript
import { SurveyForm } from 'survey-form-package';

function MyApp() {
  const surveyData = {
    rootNode: {
      type: "section",
      name: "Customer Feedback",
      items: [
        {
          type: "set",
          name: "Contact Information",
          items: [
            {
              type: "textfield",
              fieldName: "name",
              label: "Full Name",
              placeholder: "Enter your full name"
            },
            {
              type: "selectablebox",
              fieldName: "rating",
              label: "How satisfied are you?",
              options: [
                { id: "very-satisfied", label: "Very Satisfied", value: "5" },
                { id: "satisfied", label: "Satisfied", value: "4" },
                { id: "neutral", label: "Neutral", value: "3" },
                { id: "dissatisfied", label: "Dissatisfied", value: "2" },
                { id: "very-dissatisfied", label: "Very Dissatisfied", value: "1" }
              ]
            }
          ]
        }
      ]
    }
  };

  return (
    <SurveyForm
      survey={surveyData}
      theme="modern"
      layout="page-by-page"
      progressBar={{
        type: 'percentage',
        showPercentage: true,
        position: 'top'
      }}
      onSubmit={(data) => console.log('Survey submitted:', data)}
      onChange={(data) => console.log('Data changed:', data)}
    />
  );
}
```

### **Unified Block System**

The survey package now uses a **unified block architecture** where each block contains both builder and renderer components in a single definition. This makes it easier to create, maintain, and extend blocks.

#### **Creating Custom Blocks**

```typescript
import React, { useEffect } from 'react';
import { BlockDefinition, registerBlock } from 'survey-form-package';

const CustomRatingBlock: BlockDefinition = {
  type: 'star-rating',
  name: 'Star Rating',
  description: 'Visual star rating component',
  icon: <StarIcon className="w-4 h-4" />,
  defaultData: {
    type: 'star-rating',
    fieldName: 'rating',
    label: 'Rate your experience',
    maxStars: 5,
    allowHalfStars: true
  },
  
  // BUILDER COMPONENTS
  renderItem: ({ data }) => (
    // How block appears in builder preview
    <StarRatingComponent maxStars={data.maxStars} disabled />
  ),
  renderFormFields: ({ data, onUpdate }) => (
    // Configuration form in builder
    <div className="space-y-4">
      <div>
        <label>Label</label>
        <input 
          value={data.label || ''}
          onChange={(e) => onUpdate?.({ ...data, label: e.target.value })}
        />
      </div>
      <div>
        <label>Maximum Stars</label>
        <input 
          type="number"
          value={data.maxStars || 5}
          onChange={(e) => onUpdate?.({ ...data, maxStars: parseInt(e.target.value) })}
        />
      </div>
    </div>
  ),
  renderPreview: () => (
    // Small preview in block library
    <div className="flex justify-center">
      <StarRatingComponent maxStars={5} value={3} disabled />
    </div>
  ),
  
  // RENDERER COMPONENT - NEW UNIFIED APPROACH
  renderBlock: ({ block, value, onChange, error, disabled }) => (
    // How block renders in actual surveys
    <div className="space-y-2">
      {block.label && (
        <label className="block text-sm font-medium">
          {block.label}
        </label>
      )}
      <StarRatingComponent
        value={value || 0}
        maxStars={block.maxStars || 5}
        allowHalfStars={block.allowHalfStars}
        onChange={onChange}
        disabled={disabled}
      />
      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  ),
  
  // VALIDATION
  validate: (data) => {
    if (!data.fieldName) return "Field name is required";
    return null;
  },
  validateValue: (value, data) => {
    if (data.required && !value) return "Rating is required";
    return null;
  },
};

// Register the custom block
function MyApp() {
  useEffect(() => {
    registerBlock(CustomRatingBlock);
  }, []);

  return (
    <SurveyBuilder
      blockDefinitions={[...StandardBlocks, CustomRatingBlock]}
      // ... other props
    />
  );
}
```

#### **Unified Block Benefits**

- ✅ **Single Source of Truth**: One file defines both builder and renderer behavior
- ✅ **Easier Maintenance**: Changes only need to be made in one place  
- ✅ **Better Type Safety**: Shared interfaces ensure consistency
- ✅ **Simplified Extension**: Custom blocks only need one implementation
- ✅ **Validation Consolidation**: Both config and value validation in one place

#### **Available Block Types (18 Built-in)**

All blocks use the unified system and support both builder and renderer functionality:

| Block Type | Description | Input Type |
|------------|-------------|------------|
| `textfield` | Single line text input | Text |
| `textarea` | Multi-line text area | Text |
| `radio` | Single choice selection | Option |
| `checkbox` | Multiple choice selection | Array |
| `select` | Dropdown selection | Option |
| `range` | Slider/range input | Number |
| `datepicker` | Date selection | Date |
| `fileupload` | File upload | File |
| `matrix` | Grid/table questions | Object |
| `selectablebox` | Visual selection boxes | Option |
| `markdown` | Rich text content | N/A |
| `html` | Raw HTML content | N/A |
| `script` | Custom JavaScript | N/A |
| `auth` | Authentication forms | Object |
| `bmiCalculator` | BMI calculation | Number |
| `calculated` | Dynamic calculations | Number |
| `conditional` | Conditional logic | Any |
| `checkout` | Payment forms | Object |

#### **Block Registration**

```typescript
import { registerBlock, unregisterBlock, getBlockDefinition } from 'survey-form-package';

// Register a custom block
registerBlock(MyCustomBlock);

// Get a registered block
const blockDef = getBlockDefinition('my-custom-type');

// Unregister a block
unregisterBlock('my-custom-type');
```

#### **Documentation**

- 📖 [Custom Blocks Guide](./src/packages/survey-form-package/CUSTOM_BLOCKS_GUIDE.md) - Comprehensive guide for creating custom blocks
- 📖 [Block Migration Guide](./src/packages/survey-form-package/BLOCK_MIGRATION_GUIDE.md) - Migration status and legacy block information

### **Advanced Conditional Logic**

```typescript
// Example: Show different questions based on user type
const conditionalSurvey = {
  rootNode: {
    type: "section",
    name: "User Assessment",
    items: [
      {
        type: "set",
        name: "User Type",
        items: [
          {
            type: "selectablebox",
            fieldName: "userType",
            label: "What type of user are you?",
            options: [
              { id: "beginner", label: "Beginner", value: "beginner" },
              { id: "intermediate", label: "Intermediate", value: "intermediate" },
              { id: "advanced", label: "Advanced", value: "advanced" }
            ],
            navigationRules: [
              {
                condition: "userType == 'beginner'",
                target: "beginner-questions-page-id",
                isPage: true
              },
              {
                condition: "userType == 'advanced'",
                target: "advanced-questions-page-id",
                isPage: true
              }
            ]
          }
        ]
      }
    ]
  }
};
```

## 🔧 Configuration

### **Survey Form Props**

```typescript
interface SurveyFormProps {
  survey: {
    rootNode: NodeData;
    localizations?: LocalizationMap;
    theme?: ThemeDefinition;
  };
  onSubmit?: (data: Record<string, any>) => void;
  onChange?: (data: Record<string, any>) => void;
  onPageChange?: (pageIndex: number, totalPages: number) => void;
  defaultValues?: Record<string, any>;
  language?: string;
  theme?: SurveyTheme;
  layout?: SurveyLayout;
  progressBar?: ProgressBarOptions;
  navigationButtons?: NavigationButtonsOptions;
  autoScroll?: boolean;
  autoFocus?: boolean;
  showSummary?: boolean;
  className?: string;
  logo?: ReactNode;
  enableDebug?: boolean;
}
```

### **Layout Options**

```typescript
type SurveyLayout = 
  | "page-by-page"  // Traditional multi-page navigation
  | "continuous"    // Single scrollable page
  | "accordion"     // Collapsible sections
  | "tabs"          // Tabbed interface
  | "stepper"       // Step-by-step with progress
  | "fullpage";     // Full-screen experience
```

### **Progress Bar Configuration**

```typescript
interface ProgressBarOptions {
  type?: "bar" | "dots" | "numbers" | "percentage";
  showPercentage?: boolean;
  showStepInfo?: boolean;
  showStepTitles?: boolean;
  position?: "top" | "bottom";
  animation?: boolean;
}
```

## 🎯 Sample Survey Structure

The project includes a comprehensive sample survey demonstrating:

- **Multi-page navigation** with conditional routing
- **Selectable box questions** with auto-continue functionality
- **Conditional logic** based on user responses
- **Custom HTML result pages** with tailored recommendations
- **Checkout integration** for lead capture
- **Professional styling** with consistent theming

Key features demonstrated:
- Career assessment with personalized recommendations
- Educational background evaluation
- Skills and interests mapping
- Dynamic page routing based on responses
- Custom result pages with actionable advice

## 🛠️ Development

### **Project Structure**
```
react-survey-builder/
├── src/
│   ├── app/                          # Next.js application
│   │   ├── builder/                  # Visual survey builder
│   │   ├── demo/                     # Interactive demo
│   │   └── page.tsx                  # Landing page with sample survey
│   ├── packages/
│   │   └── survey-form-package/      # Core survey package
│   │       ├── src/
│   │       │   ├── builder/          # Survey builder components
│   │       │   │   ├── blocks/       # Block definitions
│   │       │   │   ├── survey/       # Builder interface
│   │       │   │   └── common/       # Shared components
│   │       │   ├── renderer/         # Survey renderer
│   │       │   │   ├── layouts/      # Layout components
│   │       │   │   ├── renderers/    # Block renderers
│   │       │   ├── components/       # UI components
│   │       │   ├── context/          # React contexts
│   │       │   ├── hooks/            # Custom hooks
│   │       │   |── themes/           # Theme definitions
│   │       │   ├── utils/            # Utility functions
│   │       │   └── types.ts          # TypeScript definitions
│   │       └── package.json
│   └── components/                   # Shared UI components
├── public/                           # Static assets
└── package.json                      # Main package configuration
```

### **Adding Custom Blocks**

1. **Create block definition**
```typescript
// src/packages/survey-form-package/src/builder/blocks/YourCustomBlock.tsx
import { BlockDefinition } from '../../types';

export const YourCustomBlock: BlockDefinition = {
  type: 'your-custom-type',
  name: 'Your Custom Block',
  description: 'Description of your block',
  icon: <YourIcon />,
  defaultData: {
    type: 'your-custom-type',
    // default properties
  },
  renderItem: ({ data, value, onChange }) => {
    // Render logic for the actual form
  },
  renderFormFields: ({ data, onUpdate }) => {
    // Render configuration form for the builder
  },
  renderPreview: () => {
    // Render preview in block library
  }
};
```

2. **Add corresponding renderer**
```typescript
// src/packages/survey-form-package/src/renderer/renderers/YourCustomRenderer.tsx
export const YourCustomRenderer: React.FC<BlockRendererProps> = ({ 
  block, 
  value, 
  onChange 
}) => {
  // Render logic for the survey form
};
```

3. **Register in index files**
```typescript
// Add to src/packages/survey-form-package/src/builder/blocks/index.ts
export { YourCustomBlock } from './YourCustomBlock';

// Add to BlockRenderer.tsx
import { YourCustomRenderer } from './YourCustomRenderer';
```

### **Tech Stack**
- **Framework**: React 19 with Next.js 15
- **Build Tool**: Turbopack for fast development
- **Styling**: Tailwind CSS 4 with CSS-in-JS
- **UI Components**: Radix UI primitives
- **Animations**: Framer Motion
- **Drag & Drop**: @dnd-kit
- **Type Safety**: TypeScript 5
- **Package Management**: bun workspaces
- **Bundling**: tsup for package builds

### **Performance Optimizations**
- **Tree Shaking**: Modular imports and exports
- **Code Splitting**: Dynamic imports for layouts and renderers
- **Memoization**: React.memo and useMemo for expensive calculations
- **Lazy Loading**: Components loaded on demand
- **Bundle Analysis**: Optimized package sizes

## 📚 API Reference

### **Core Components**

#### **SurveyForm**
Main component for rendering surveys.

```typescript
<SurveyForm
  survey={surveyData}
  theme="modern"
  layout="page-by-page"
  onSubmit={handleSubmit}
  onChange={handleChange}
  progressBar={{ type: 'percentage', position: 'top' }}
  navigationButtons={{ showPrevious: true, showNext: true }}
/>
```

#### **SurveyBuilder**
Visual builder component for creating surveys.

```typescript
<SurveyBuilder
  blockDefinitions={[...StandardBlocks, ...customBlocks]}
  nodeDefinitions={StandardNodes}
  onDataChange={handleDataChange}
  initialData={existingSurvey}
/>
```

### **Hooks**

#### **useSurveyForm**
```typescript
const {
  values,
  errors,
  currentPage,
  totalPages,
  goToPage,
  goToNextPage,
  goToPreviousPage,
  submit,
  isValid
} = useSurveyForm(survey, options);
```

#### **useMobileNavigation**
```typescript
const {
  enableSwipe,
  handleSwipeLeft,
  handleSwipeRight,
  swipeDirection
} = useMobileNavigation({
  onSwipeLeft: goToNextPage,
  onSwipeRight: goToPreviousPage
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Setup**
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting: `bun run lint`
6. Submit a pull request

## 📄 License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/). 

- ✅ **Permitted**: Open source projects, educational use, personal projects
- ❌ **Requires License**: Commercial use, SaaS products, client projects

For commercial licensing, please contact the maintainers.

## 🙏 Acknowledgments

- **Radix UI** for accessible component primitives
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations
- **@dnd-kit** for drag-and-drop functionality
- **React** and **Next.js** teams for excellent frameworks

## 📞 Support

- 📧 **Email**: [sayeed99@live.com]
- 💬 **Discussions**: [GitHub Discussions](https://github.com/UNISELL-DEV/react-survey-builder/discussions)
- 🐛 **Issues**: [GitHub Issues](https://github.com/UNISELL-DEV/react-survey-builder/issues)

---

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International License](https://creativecommons.org/licenses/by-nc/4.0/). You may use the code for open source or other non-commercial purposes. For commercial use or projects where you will charge end users, please contact the maintainers to obtain a commercial license.


## Uniloop EMR enrollment workspace

Open `/emr-demo` (also available at `/emr-builder-demo`). Enter a Uniloop
merchant bearer token and set the **Uniloop base URL** to your merchant domain and click **Save connection & load plans**. The token remains
visible and is stored as `uniloop_emr_demo_token` in local storage. Returning to
this page reloads the plans; changing or clearing that storage value in another
tab updates the session. Use **Clear token** to disconnect.

Set `UNILOOP_API_URL` in `.env.local` to your Uniloop origin, for example
`http://127.0.0.1:8000`. The server calls `/api/v1/merchant` at this origin.
`LARAVEL_API_URL` is also supported; the existing default is `https://my.ivyrx.com`.
The merchant token needs `enrollment:read` for treatment plan loading. It is never
used for EMR enrollment utility actions. OTP send/verification uses the native
`/api/v2/patient` endpoints on the configured merchant domain. After authentication,
the patient JWT is sent in `Authorization: Bearer <patient-token>` for profile,
vitals, coupons, billing and Stripe calls, preserving the hosted utilities’ URLs
and HTTP methods. No Stripe secret is required locally.

Each enrollment form returned by the treatment plan is listed in sequence.
Choose a form and use **Edit in SurveyFormBuilder**, then **Render form** to run
the edited schema. Edits are held in memory and never update the merchant's
published forms. The last form submits the enrollment through Uniloop after
required forms are answered. These are real API operations against the configured
account. Refill intakes are outside this demo's current scope.

Custom blocks receive the same shared session across all forms:

```tsx
const { customData } = useSurveyForm();
const utils = customData.emrEnrollmentUtils;
// Also supplied: enrollmentForms, currentEnrollmentForm,
// completedFormResponses, and the legacy enrollmentModule adapter.
```

Add local block definitions in `src/app/emr-demo/custom-blocks/index.ts`.
Local block types take precedence over merchant-published blocks of the same
type. Other published ESM blocks, layouts and merchant CSS are loaded from their
plan URLs; their CDN must allow browser imports from your local origin.

Run the transport and API proxy tests with `bun run test:emr`, and check the
EMR workspace and its dependency graph with `bun run typecheck:emr`. The full
project type check currently also includes copied patient-portal helpers that
require Uniloop’s Inertia environment; those helpers are not imported by this
workspace.

The base URL is saved as `uniloop_emr_demo_base_url`. Leave it blank to use the
server environment configuration. The browser always calls the local proxy;
the connection panel shows the actual upstream origin. HTTPS merchant custom
domains and HTTP loopback development origins are supported.

Patient requests are forwarded through `/api/uniloop-patient`, while treatment
plan requests use `/api/uniloop`. The shared `emrEnrollmentUtils` instance supplies
the authenticated patient token; no merchant token is attached to patient calls.
Pending profile edits remain queued when saving fails.

The current Uniloop web routes `/emr/enroll/{slug}` and its `preferred-drugs`
action are preserved too. Unlike the native patient API routes, those web routes
currently require a hosted session/CSRF token. If Uniloop returns 419, the demo
reports that the backend needs patient bearer support for that action. The demo
does not substitute the merchant-scoped API or bypass CSRF protection.
