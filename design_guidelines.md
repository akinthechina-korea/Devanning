# Design Guidelines: Uni-pass Cargo Tracking Application

## Design Approach: Utility-First Data Display System

This cargo tracking application prioritizes **clarity, efficiency, and data accessibility** for professional users querying customs clearance information. The design follows a systematic approach inspired by enterprise data applications like Linear and Notion, with emphasis on clean typography and structured information display.

## Typography System

**Primary Font Family:** Inter (via Google Fonts CDN)
**Fallback:** System UI fonts optimized for Korean (Noto Sans KR, Apple SD Gothic Neo)

**Hierarchy:**
- Page Title (조회 섹션): text-2xl (24px), font-bold, leading-tight
- Section Headings: text-xl (20px), font-bold, with bottom border separator
- Table Headers: text-xs (12px), font-semibold, uppercase for data tables
- Table Header Labels (info tables): text-sm (14px), font-semibold
- Body Text/Data: text-sm (14px), font-normal
- Form Labels: text-sm (14px), font-medium
- Button Text: text-base (16px), font-bold

## Layout System

**Container Architecture:**
- Outer wrapper: max-w-4xl, mx-auto (centered, max 896px width)
- Padding units: p-4 on mobile, p-8 on desktop for outer container
- Section padding: p-6 consistent across all content sections
- Vertical spacing between sections: space-y-8

**Grid System for Data Display:**
- Two-column layout for basic info tables: grid-cols-1 md:grid-cols-2
- Full-width tables for container and arrival data
- Responsive breakpoints: mobile (base), tablet (sm/md), desktop (lg)

**Spacing Primitives (Tailwind Units):**
Primary spacing scale: 2, 3, 4, 6, 8
- Component gaps: gap-4
- Table cell padding: p-3
- Form input padding: px-4 py-3
- Section margins: mb-4, mb-8

## Component Library

### 1. Header Section (Query Form)
**Background treatment:** Solid slate-700 (dark header bar)
**Structure:**
- Full-width header with p-6 padding
- Flexbox layout (flex-col on mobile, flex-row on tablet+)
- Three input zones: B/L text input (flex-grow), Year dropdown, Search button

**Form Inputs:**
- Input fields: w-full, px-4 py-3, rounded-md, h-[50px] for consistent height
- Focus states: focus:border-indigo-500, focus:ring-indigo-500
- Label styling: text-sm, font-medium, block mb-1

**Primary Action Button:**
- Blue accent: bg-blue-600, hover:bg-blue-700
- Icon + text combination (search icon from Heroicons via inline SVG)
- Height: h-[50px] matching input fields
- Padding: px-6 py-3
- Shadow: shadow-md
- Font: font-bold

### 2. Data Display Tables

**Information Tables (Basic Cargo Info):**
- Two-column grid layout creating side-by-side key-value pairs
- Table headers: bg-gray-100, text-left alignment
- Header cells: p-3, text-sm, font-semibold
- Data cells: bg-white, p-3, text-sm
- Border treatment: border border-gray-200 with rounded-lg corners
- Special emphasis: Status field uses font-bold with text-blue-700

**Data List Tables (Containers, Arrival Reports):**
- Full-width responsive tables with overflow-x-auto wrapper
- Header row: bg-gray-100, uppercase text-xs, font-semibold
- Column headers: text-left, p-3
- Body rows: divide-y divide-gray-200 for row separation
- Cell padding: p-3 consistent

### 3. Section Dividers
**Pattern:**
- Section title: text-xl, font-bold
- Bottom border: border-b border-gray-300
- Padding below title: pb-2
- Margin below divider: mb-4

### 4. Loading and Message States

**Loading Indicator:**
- Centered layout: flex justify-center items-center
- Animated spinner (SVG): h-8 w-8, animate-spin, text-blue-600
- Loading text: text-lg, font-medium

**Error Messages:**
- Text styling: text-red-600, font-semibold
- Centered display

## Visual Hierarchy and Information Architecture

**Screen Structure (Top to Bottom):**
1. **Query Section** (slate-700 background) - Primary user action area
2. **Loading/Message Area** - Conditional visibility, centered
3. **Results Area** (space-y-8) - Three distinct sections:
   - Basic Cargo Progress Info (two-column table grid)
   - Container Details (horizontal scrolling table)
   - Arrival Report Details (horizontal scrolling table)

**Data Emphasis Strategy:**
- Status information receives visual weight through bold font and color
- Table headers use subtle background differentiation (gray-100)
- White backgrounds for data create clean reading experience
- Borders and dividers provide clear section separation without heavy lines

## Responsive Behavior

**Mobile (base to sm):**
- Single column form layout (flex-col)
- Full-width buttons and inputs
- Tables maintain horizontal scroll capability
- Reduced outer padding (p-4)

**Tablet (md):**
- Two-column grid for basic info tables activates
- Form switches to horizontal layout (flex-row)
- Padding increases (p-8)

**Desktop (lg+):**
- Maximum container width enforced (max-w-4xl)
- Optimal table column widths
- All multi-column layouts active

## Accessibility Considerations

- Semantic HTML table structures for screen readers
- Proper label associations for all form inputs
- Sufficient contrast ratios (slate-700/white, blue-700/white)
- Focus states clearly defined with ring utilities
- Logical tab order through form elements

## Professional Data Application Aesthetics

**Design Principles:**
- **Clarity over decoration:** Minimal visual noise, data-first presentation
- **Consistent rhythm:** Regular spacing and alignment throughout
- **Professional restraint:** Limited color palette focused on readability
- **Functional hierarchy:** Visual weight matches information importance
- **Responsive professionalism:** Maintains clean appearance across devices

This design creates a trustworthy, government-service aesthetic appropriate for customs clearance data while maintaining modern web standards and usability best practices.