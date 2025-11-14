# 유니패스 화물 추적 앱 (Uni-pass Cargo Tracking Application)

## Overview

This project is a web application designed to track cargo clearance information using the Korea Customs Service Uni-pass API. It generates official import cargo inspection forms based on Bill of Lading (B/L) numbers and Item Numbers from an inbound list database. The application aims to streamline the process of monitoring cargo movement, generating necessary documentation for import and quarantine procedures, and providing a custom form template system for flexible manifest generation. Its business vision is to provide a robust, user-friendly tool for efficient cargo management in import operations.

## User Preferences

I prefer a clear, professional, and concise communication style. When discussing code or features, please provide explanations that are easy to understand without excessive jargon. I appreciate a structured approach to development, focusing on completing one feature at a time and ensuring its stability before moving to the next. For any significant architectural changes or new feature implementations, please ask for my approval before proceeding. I value detailed explanations when complex issues arise.

## System Architecture

The application follows a full-stack architecture using React for the frontend and Node.js with Express for the backend. It includes a multi-user system with role-based access control and complete data isolation between users.

### UI/UX Decisions
-   **Typography**: Inter and Noto Sans KR fonts for a professional Korean interface.
-   **Color Scheme**: Slate 700 for headers and blue accents for interactive elements.
-   **Layout**: Responsive design supporting mobile, tablet, and desktop views.
-   **Accessibility**: Clear labels, appropriate contrast, and keyboard navigation.

### Technical Implementations
-   **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for data fetching (including cascading queries), Shadcn UI Components for modern UI, Tailwind CSS for styling, and React Hook Form with Zod for form validation. PDF generation uses jsPDF and html2canvas. Excel parsing is handled by the XLSX library.
    -   **A4-Optimized Manifest Scaling**: All manifest views (Preview, Print/PDF, Batch Print, HTML Download, Template Editor) use a unified scaling system (`manifest-scaling.ts`) with independent X/Y scaling (non-proportional) to maximize A4 coverage without maintaining aspect ratio. Implements 0mm margins, maxUpscale 6.0x for aggressive A4 filling, and responsive calculation per template dimensions. `CustomManifestPreview` separates screen display (targetMode: 'preview' with size constraints) from print rendering (targetMode: 'print' for A4 maximization) using dual containers: visible preview and hidden print-optimized version.
-   **Backend**: Node.js and Express in TypeScript, integrating with a PostgreSQL database (Neon) via Drizzle ORM. Axios is used for HTTP requests to the Uni-pass API, and Fast-XML-Parser handles XML responses. Implements RESTful CRUD API endpoints for form template management and user-scoped data. Session-based authentication with bcrypt hashing is used for security.
-   **Database**: PostgreSQL (Neon) with Drizzle ORM, using a dual-table architecture:
    -   `inbound_list` (32 fields): Stores uploaded Excel data (Devanning Check List format) with `userId`.
    -   `manifest_results` (25 fields): Caches merged cargo manifests (Unipass API + inbound data) with `userId` and FK to `inbound_list`.
    -   `form_templates`: Stores custom template structures as JSON with metadata, accessible globally but managed by admins only. Includes an `updatedAt` field for cache invalidation.
    -   `users`: Stores user authentication details and roles.

### Feature Specifications
-   **Dropdown-based Integrated Search**: Loads unique B/L numbers from the inbound list, supports multi-select, select-all, search filtering, and cascading selection for Item Numbers based on selected B/Ls and dates. Automatically recognizes B/L format (Master vs. House B/L).
-   **Data Merging and Display**: Real-time customs clearance information from Uni-pass API, displaying detailed cargo tracking. Generates a 25-field official import cargo inspection form by merging Uni-pass data with inbound list data. Provides PDF download and in-browser printing.
-   **Custom Form Template System**: Allows creation, editing, and deletion of custom cargo manifest templates (admin-only). Supports Excel import for template structure parsing and a visual grid editor for layout customization and field mapping. Templates are stored as JSON and can be selected in cargo search results for custom manifest generation and PDF output.
-   **Inbound List Editing**: Users can edit their uploaded inbound list entries through an intuitive dialog interface. Supports editing 17 fields (description, qty, 구분, 수입자, 반입일자, plt, 매수, tie, unit, dept, itemNo, mpk, 높이, 도착예정Time, 비고, costcoBlNo, containerCntrNo). Changes automatically synchronize with related manifest results using transactional updates and a shared field mapping function (`extractInboundFields`). Users can only edit entries they uploaded, with ownership validation enforced on the backend.
-   **Uni-pass API Integration**: The backend sequentially calls Uni-pass APIs (API019 for basic info, then parallel calls to API020 for containers, API021 for arrival reports, and API024 for clearance progress) using the cargo management number.
-   **Shared Data Access**: All authenticated users can view cargo data uploaded by any user (intentional security model for collaborative workflows). While data is visible to all users, editing is restricted to the original uploader to maintain data integrity.
-   **Date Filtering**: Incorporates a cascading date filter in the cargo search form, allowing users to filter B/L numbers by specific dates from their inbound lists.

### System Design Choices
-   **Data Flow**: Excel Uploads populate `inbound_list`. Cargo queries join Uni-pass API data with `inbound_list` to create `manifest_results` cache. Subsequent queries fetch from `manifest_results` to minimize API calls.
-   **Error Handling**: UI provides loading and error states. API failures allow fallback manifest generation using only `inbound_list` data.
-   **Cache Invalidation**: Server-driven cache-busting for form templates using `Cache-Control` headers and `updatedAt` timestamps ensures real-time updates for all clients.
-   **Database Schema**: Upgraded to a 32-field structure for `inbound_list` and migrated date fields from text to date type, supporting various date formats for robust parsing.

## External Dependencies

-   **Korea Customs Service Uni-pass API**: For real-time cargo clearance information (API019, API020, API021, API024).
-   **PostgreSQL (Neon)**: Cloud-hosted relational database.
-   **Axios**: HTTP client for making requests to external APIs.
-   **Fast-XML-Parser**: For parsing XML responses from the Uni-pass API.
-   **jsPDF & html2canvas**: For client-side PDF generation.
-   **XLSX library**: For parsing Excel files.