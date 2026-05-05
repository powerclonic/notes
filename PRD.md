# Planning Guide

An intelligent note digitization application that transforms handwritten notes and slide images into structured, corrected digital notes using AI-powered text recognition with human-in-the-loop verification.

**Experience Qualities**:
1. **Efficient** - Streamlined process from image capture to structured notes with minimal friction
2. **Collaborative** - Human-AI partnership where users verify uncertain words to improve accuracy
3. **Intelligent** - Smart OCR that recognizes its limitations and asks for help when needed

**Complexity Level**: Light Application (multiple features with basic state)
  - The app combines image capture/upload, AI processing, review workflows, and note management - multiple interconnected features with persistent state but not requiring complex multi-view architecture.

## Essential Features

### Image Capture/Upload
- **Functionality**: Accept images through camera capture or file upload
- **Purpose**: Provide flexible input methods for different use cases (real-time capture vs existing images)
- **Trigger**: User clicks "Take Photo" or "Upload Image" button
- **Progression**: Click button → Camera opens/File picker appears → Capture/Select image → Preview shown → Confirm → Process
- **Success criteria**: Image successfully captured/uploaded and displayed for user confirmation

### AI Text Recognition
- **Functionality**: Extract text from images using Spark LLM API, identify uncertain words
- **Purpose**: Convert visual text into editable digital format with confidence tracking
- **Trigger**: User confirms image for processing
- **Progression**: Image sent to AI → Text extracted with confidence markers → Uncertain words flagged → Review interface generated
- **Success criteria**: Text accurately extracted with uncertain sections properly identified for review

### Human Review Workflow
- **Functionality**: Present flagged words to user for verification/correction
- **Purpose**: Ensure accuracy through human oversight where AI is uncertain
- **Trigger**: AI processing completes with uncertain words
- **Progression**: Flagged words highlighted → User clicks word → Edit modal opens → User corrects → Confirmation → Next word or completion
- **Success criteria**: All uncertain words reviewed, corrections applied, final note generated

### Structured Note Output
- **Functionality**: Format corrected text into clean, organized notes with proper structure
- **Purpose**: Create readable, well-formatted notes from raw extracted text
- **Trigger**: Review process completes
- **Progression**: Final text processed → Structure applied (headings, bullets, formatting) → Note saved → Display in library
- **Success criteria**: Notes properly formatted, saved to persistent storage, viewable in organized list

### Note Library
- **Functionality**: View, search, edit, and delete saved notes
- **Purpose**: Manage collection of digitized notes over time
- **Trigger**: User navigates to notes library
- **Progression**: Click library → View list → Select note → Read/Edit → Save changes
- **Success criteria**: All notes accessible, searchable, editable, and deletable

## Edge Case Handling
- **No text detected**: Display friendly message suggesting better lighting/angle and allow re-capture
- **All words uncertain**: Offer bulk editing interface rather than word-by-word review
- **Very long text**: Chunk processing and show progress indicator
- **Camera permission denied**: Clear instructions and fallback to upload-only mode
- **Image too large**: Automatic compression before processing
- **Network failure during processing**: Save image locally, retry mechanism with visual feedback

## Design Direction
The design should evoke trust, clarity, and intelligence - like a knowledgeable assistant helping you organize your thoughts. It should feel modern and professional yet approachable, with emphasis on readability and clear visual hierarchy that guides users through the capture-review-save workflow.

## Color Selection
A professional academic palette with warm accents to feel approachable and intelligent.

- **Primary Color**: Deep Indigo (oklch(0.35 0.15 270)) - Communicates intelligence, trust, and academic professionalism
- **Secondary Colors**: Soft Slate (oklch(0.65 0.02 250)) for backgrounds and supporting UI elements; Light Lavender (oklch(0.92 0.04 280)) for subtle cards
- **Accent Color**: Vibrant Coral (oklch(0.68 0.19 25)) - Draws attention to CTAs, review actions, and important interactive elements
- **Foreground/Background Pairings**: 
  - Primary (Deep Indigo oklch(0.35 0.15 270)): White text (oklch(0.99 0 0)) - Ratio 8.9:1 ✓
  - Accent (Vibrant Coral oklch(0.68 0.19 25)): White text (oklch(0.99 0 0)) - Ratio 5.2:1 ✓
  - Background (Light Lavender oklch(0.92 0.04 280)): Dark Slate text (oklch(0.25 0.05 270)) - Ratio 11.8:1 ✓
  - Secondary (Soft Slate oklch(0.65 0.02 250)): White text (oklch(0.99 0 0)) - Ratio 4.8:1 ✓

## Font Selection
Typography should balance academic credibility with modern digital clarity - professional yet friendly for note-taking contexts.

- **Typographic Hierarchy**:
  - H1 (Page Title): Space Grotesk Bold/32px/tight tracking
  - H2 (Note Title): Space Grotesk Semibold/24px/normal tracking
  - H3 (Section Headers): Space Grotesk Medium/18px/normal tracking
  - Body (Note Content): Inter Regular/16px/1.6 line height/relaxed
  - Small (Metadata): Inter Regular/14px/muted color
  - Button Text: Inter Semibold/15px/normal tracking

## Animations
Animations should communicate processing states and guide attention during the review workflow - purposeful transitions that make the AI processing feel responsive and the review flow feel natural.

- **Image capture feedback**: Quick scale and flash effect on capture
- **Processing state**: Smooth pulsing on AI processing indicator
- **Word highlight**: Gentle color transition when hovering uncertain words
- **Review modal**: Smooth slide-up with backdrop fade
- **Note save**: Satisfying check animation with subtle bounce
- **List updates**: Fade and slide transitions when adding/removing notes

## Component Selection
- **Components**:
  - `Card` for note previews and main content areas
  - `Dialog` for review/editing workflows (word correction modal)
  - `Button` for primary actions (capture, upload, save, process)
  - `Input` & `Textarea` for note editing and corrections
  - `Badge` to indicate uncertain words and processing status
  - `ScrollArea` for note library list
  - `Tabs` to switch between "New Note" and "Library" views
  - `Alert` for error states and helpful tips
  - Custom camera component using browser Media API
  
- **Customizations**:
  - Custom image preview component with crop/rotate capabilities
  - Custom word review interface with inline editing
  - Custom note renderer with markdown-like formatting
  - Progress indicator for processing state
  
- **States**:
  - Buttons: Prominent shadow on primary, subtle border on secondary, disabled state with opacity
  - Uncertain words: Yellow highlight background, coral underline on hover, pulsing border when active
  - Note cards: Hover lift effect, selected state with primary border
  - Camera view: Live preview with overlay grid, capture button with ripple effect
  
- **Icon Selection**:
  - Camera (regular) for photo capture
  - Upload (regular) for file upload
  - MagnifyingGlass for search notes
  - PencilSimple for edit actions
  - Check for confirmations
  - Warning for uncertain words
  - Trash for delete actions
  - ArrowsClockwise for retry/reprocess
  
- **Spacing**:
  - Container padding: p-6 (desktop), p-4 (mobile)
  - Card padding: p-6
  - Button spacing: px-6 py-3 (primary), px-4 py-2 (secondary)
  - Stack gaps: gap-6 (major sections), gap-4 (related items), gap-2 (tight groups)
  - Grid gaps: gap-4 for note library grid
  
- **Mobile**:
  - Single column layout for all views
  - Bottom-sheet style for review modal (using Drawer component)
  - Full-width camera capture with large tap target
  - Simplified note cards with essential info only
  - Fixed bottom action bar for primary actions
  - Touch-friendly 44px minimum hit areas
