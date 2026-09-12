# Dolfin
## AI Store Manager — Frontend & Phinite API Integration Specification

**Version:** MVP v1.0  
**Application:** Dolfin  
**Frontend:** Next.js + React + TypeScript  
**Deployment:** Vercel  
**AI Backend:** Phinite Agent Graph APIs  
**Primary Users:** SMB / retail merchants  
**Primary MVP:** Inventory + Vendor + Procurement

---

# 1. Purpose

Build the production-quality frontend for **Dolfin**, an AI Store Manager for merchant procurement.

The AI agents and Agent Graph will be built separately inside Phinite.

The frontend application must consume the **Phinite APIs/triggers provided as environment variables** and present the resulting AI capabilities through a polished merchant-facing interface.

### Important

Codex is **NOT responsible for building the Phinite Agent Graph**.

Phinite is an external backend.

The implementation should assume that the developer will provide:

- Phinite API/trigger URL(s)
- Authentication/API key
- Request schema
- Response schema
- Graph/build identifiers if required

The frontend should be designed around these APIs.

---

# 2. Product Positioning

## Product

**Dolfin**

## Tagline

> **Your AI Store Manager**

## Core promise

Dolfin helps a merchant answer:

> **What should I restock?**

> **How much should I buy?**

> **Who should I buy it from?**

> **Why is that the best decision?**

The MVP should feel like an AI employee rather than a traditional inventory dashboard.

---

# 3. Product Flow

The primary user journey is:

```text
Merchant
   ↓
Dolfin Dashboard
   ↓
Ask Dolfin
   ↓
Phinite Agent Graph
   ↓
Inventory Agent
   ↓
Vendor Agent
   ↓
Procurement Recommendation
   ↓
Merchant Reviews
   ↓
Approve
   ↓
Purchase Order
```

The frontend does not implement the reasoning.

The frontend presents the reasoning returned by Phinite.

---

# 4. Architecture

```text
                         DOLFIN WEB APP
                              │
                              ▼
                    ┌───────────────────┐
                    │     Next.js       │
                    │      React        │
                    │    TypeScript     │
                    └─────────┬─────────┘
                              │
                    Server-side API routes
                              │
                              ▼
                    ┌───────────────────┐
                    │ Phinite API       │
                    │ Adapter           │
                    └─────────┬─────────┘
                              │
                         HTTPS request
                              │
                              ▼
                    ┌───────────────────┐
                    │     Phinite       │
                    │   Agent Graph     │
                    └─────────┬─────────┘
                              │
                  ┌───────────┴───────────┐
                  ▼                       ▼
           Inventory Agent          Vendor Agent
                  │                       │
                  └───────────┬───────────┘
                              ▼
                     Structured Response
                              │
                              ▼
                    Next.js API response
                              │
                              ▼
                         React UI
```

---

# 5. Technology Stack

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide React
- Recharts
- Zod

Use the Next.js App Router.

Do not introduce unnecessary frameworks.

---

# 6. Repository Structure

Create:

```text
dolfin/
│
├── app/
│   ├── page.tsx
│   │
│   ├── chat/
│   │   └── page.tsx
│   │
│   ├── inventory/
│   │   └── page.tsx
│   │
│   ├── vendors/
│   │   └── page.tsx
│   │
│   ├── procurement/
│   │   └── page.tsx
│   │
│   └── api/
│       ├── agent/
│       │   └── route.ts
│       │
│       └── purchase-orders/
│           └── route.ts
│
├── components/
│   ├── layout/
│   ├── dashboard/
│   ├── chat/
│   ├── inventory/
│   ├── vendors/
│   ├── procurement/
│   └── ui/
│
├── lib/
│   ├── phinite/
│   │   ├── client.ts
│   │   ├── types.ts
│   │   └── mapper.ts
│   │
│   ├── demo/
│   │   └── data.ts
│   │
│   └── types/
│       └── index.ts
│
├── public/
│
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

# 7. Environment Configuration

The Phinite credentials and endpoints must be server-side.

Create:

```env
PHINITE_API_KEY=
PHINITE_AGENT_URL=
PHINITE_AGENT_METHOD=POST

NEXT_PUBLIC_APP_NAME=Dolfin

DEMO_MODE=true
```

If multiple Phinite APIs are provided, support:

```env
PHINITE_STORE_MANAGER_URL=
PHINITE_INVENTORY_URL=
PHINITE_VENDOR_URL=
PHINITE_PROCUREMENT_URL=
```

However, prefer a single Store Manager endpoint if the Phinite graph already orchestrates the specialist agents.

---

# 8. Security

Never expose:

```text
PHINITE_API_KEY
```

to the browser.

Never use:

```text
NEXT_PUBLIC_PHINITE_API_KEY
```

The browser should communicate with:

```text
/api/agent
```

The Next.js server calls Phinite.

Architecture:

```text
Browser
   ↓
/api/agent
   ↓
Phinite
```

Never:

```text
Browser
   ↓
Phinite + API key
```

---

# 9. Phinite Integration Layer

Create:

```text
lib/phinite/client.ts
```

The rest of the application must not directly call Phinite.

Expose:

```typescript
runAgent()
```

Example:

```typescript
export interface AgentRequest {
  message: string;
  merchantId: string;
  conversationId?: string;
  context?: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  sessionId?: string;

  intent?: string;

  inventory?: InventoryResult[];

  vendorRecommendation?: VendorRecommendation;

  procurementRecommendation?: ProcurementRecommendation;
}
```

Implementation:

```typescript
export async function runAgent(
  request: AgentRequest
): Promise<AgentResponse> {
  // call Phinite
  // validate response
  // normalize response
  // return typed data
}
```

---

# 10. Phinite API Configuration

The exact Phinite request and response format will be supplied separately.

Do NOT invent the schema.

Create a clear adapter section:

```typescript
// TODO: Replace with actual Phinite request schema
```

and:

```typescript
// TODO: Replace with actual Phinite response mapping
```

Once the developer provides the API documentation, update only:

```text
lib/phinite/client.ts
lib/phinite/types.ts
lib/phinite/mapper.ts
```

The rest of the application should remain unchanged.

---

# 11. Generic Agent Request

The frontend should conceptually send:

```json
{
  "message": "What should I restock today?",
  "merchant_id": "M001",
  "conversation_id": "conversation-123"
}
```

The exact field names should be changed to match the actual Phinite API.

---

# 12. Generic Agent Response

The frontend expects the normalized result to look like:

```json
{
  "message": "I found 4 products that need attention today.",
  "sessionId": "session-123",
  "intent": "REORDER_RECOMMENDATION",
  "inventory": [],
  "vendorRecommendation": {},
  "procurementRecommendation": {}
}
```

Phinite's raw response must be mapped into this frontend model.

---

# 13. Normalized Frontend Types

## InventoryResult

```typescript
export interface InventoryResult {
  productId: string;
  productName: string;

  stockLevel: number;
  reorderPoint?: number;

  inventoryStatus:
    | "HEALTHY"
    | "LOW"
    | "CRITICAL"
    | "OUT_OF_STOCK";

  restockNeeded: boolean;

  averageDailyDemand?: number;
  daysUntilStockout?: number;

  demandForecast30d?: number;

  deadStockFlag?: boolean;

  recommendedQuantity?: number;

  urgency?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

  reasoning?: string;
}
```

---

# 14. Vendor Recommendation

```typescript
export interface VendorRecommendation {
  productId: string;

  vendorId: string;
  vendorName: string;

  unitCost: number;

  availableQuantity?: number;
  minimumOrderQuantity?: number;

  leadTimeDays: number;
  reliabilityScore: number;

  recommendedQuantity: number;
  estimatedCost: number;

  vendorScore?: number;

  reason: string;

  alternatives?: VendorAlternative[];
}
```

---

# 15. Procurement Recommendation

```typescript
export interface ProcurementRecommendation {
  recommendationId: string;

  productId: string;
  productName: string;

  quantity: number;

  vendorId: string;
  vendorName: string;

  unitCost: number;
  totalCost: number;

  leadTimeDays: number;
  reliabilityScore: number;

  reason: string;

  status:
    | "RECOMMENDED"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "CREATED";
}
```

---

# 16. Dashboard

Route:

```text
/
```

The dashboard is the merchant's home.

## Header

```text
Good morning 👋

Here's what needs your attention today.
```

## KPI cards

Display:

```text
Inventory Health
86%

Items to Restock
12

Stockout Risks
4

Pending Purchases
3
```

Values should come from the available API/data response.

If unavailable, use clearly marked demo data.

---

# 17. AI Store Brief

Large primary card:

```text
TODAY'S STORE BRIEF

4 products need attention.

2 products could stock out within 3 days.

3 procurement recommendations are ready.

₹42,800 recommended purchase value.

[Review recommendations]
```

This should visually dominate the dashboard.

---

# 18. Priority Items

Show:

```text
Needs attention

🔴 Maggi 12 Pack
8 units remaining
Stockout risk: 1.3 days

Recommended:
50 units

[Review]
```

Other examples:

```text
🟠 Tata Tea
18 units
Stockout risk: 4 days

🟢 Surf Excel
Healthy
```

---

# 19. AI Chat

Route:

```text
/chat
```

This is the primary interaction surface.

Layout:

```text
┌───────────────────────────────────────────────┐
│ DOLFIN                                        │
│                                               │
│ AI Store Manager                              │
│                                               │
│ Merchant:                                     │
│ What should I restock today?                  │
│                                               │
│ Dolfin:                                       │
│ I found 4 products that need attention.       │
│                                               │
│ [Product recommendation cards]                │
│                                               │
│ ───────────────────────────────────────────   │
│ Ask Dolfin anything...                [Send]  │
└───────────────────────────────────────────────┘
```

---

# 20. Suggested Chat Prompts

Display quick actions:

```text
What should I restock?
```

```text
Which products could stock out this week?
```

```text
How much Maggi should I order?
```

```text
Who should I buy Maggi from?
```

```text
Show me dead stock.
```

```text
Prepare today's purchase orders.
```

Clicking a prompt should send it directly to `/api/agent`.

---

# 21. Chat Response Rendering

Do not render the response as plain text only.

If the API response contains inventory data:

Render an inventory card.

If it contains vendor data:

Render a vendor comparison.

If it contains procurement data:

Render a procurement recommendation card.

Example:

```text
Dolfin

I recommend ordering 50 units of Maggi 12 Pack.

┌─────────────────────────────┐
│ Maggi 12 Pack               │
│                             │
│ Stock             8         │
│ Daily demand      6         │
│ Stockout          ~1.3 days │
│                             │
│ Recommended       50 units  │
└─────────────────────────────┘
```

---

# 22. Inventory Page

Route:

```text
/inventory
```

Table:

```text
Product
Stock
Status
Demand
Stockout
Recommendation
```

Example:

```text
Maggi 12 Pack
8
Critical
6/day
1.3 days
50 units

Tata Tea 1kg
18
Low
4/day
4 days
30 units
```

Use badges for status.

---

# 23. Inventory Detail

When a merchant clicks a product:

Display:

```text
Maggi 12 Pack

Current Stock
8

Reorder Point
20

Average Daily Demand
6

Estimated Stockout
1.3 days

Recommended Order
50

30-Day Forecast
180
```

Also show a sales trend chart if sales history is available.

---

# 24. Vendor Page

Route:

```text
/vendors
```

Show vendor intelligence.

Columns:

```text
Vendor
Reliability
Average Lead Time
Products
Status
```

---

# 25. Vendor Comparison

When a merchant asks:

> Who should I buy Maggi from?

Display:

```text
Compare suppliers

             Vendor A   Vendor B   Vendor C

Price          ₹410       ₹400       ₹385
Lead time      3 days     2 days     6 days
Reliability    91%        94%        82%

                         ★ Recommended
```

The recommended vendor should be visually emphasized.

Do not calculate a different recommendation in the frontend.

The frontend must display the recommendation returned by Phinite.

---

# 26. Procurement Page

Route:

```text
/procurement
```

Sections:

### Pending Approval

Cards showing:

```text
Maggi 12 Pack

50 units

Vendor B

₹20,000

2-day delivery

94% reliability

[Review]
```

### Purchase History

```text
PO-10024
Vendor B
Maggi 12 Pack
₹20,000
Approved
```

---

# 27. Approval UX

Clicking:

```text
Review
```

opens a modal/drawer.

Display:

```text
AI PROCUREMENT RECOMMENDATION

Maggi 12 Pack

Current stock:       8
Recommended order:  50

Vendor:
Vendor B

Unit price:
₹400

Total:
₹20,000

Delivery:
2 days

Reliability:
94%

Why Dolfin recommends this:

Current inventory is expected to run out
in approximately 1.3 days. Vendor B provides
the best overall balance of price, speed and
supplier reliability.

────────────────────────────

[Reject]       [Approve Purchase]
```

---

# 28. Approval State

The frontend must explicitly track:

```text
RECOMMENDED
↓
PENDING_APPROVAL
↓
APPROVED
↓
CREATED
```

Reject:

```text
PENDING_APPROVAL
↓
REJECTED
```

Do not automatically approve.

---

# 29. Purchase Order API

Create:

```text
POST /api/purchase-orders
```

Request:

```json
{
  "recommendationId": "REC-001",
  "approved": true
}
```

The backend validates the recommendation.

Response:

```json
{
  "success": true,
  "purchaseOrder": {
    "poId": "PO-10024",
    "status": "CREATED"
  }
}
```

For the MVP, purchase orders can be stored in memory/demo state or a lightweight persistence layer.

Do not build a complicated procurement backend.

---

# 30. Purchase Success State

After approval:

Show:

```text
✓ Purchase Order Created

PO-10024

Vendor B
Maggi 12 Pack
50 units

₹20,000

Expected delivery:
2 days
```

Add:

```text
[View Purchase Order]
```

---

# 31. Error Handling

If Phinite fails:

```text
Dolfin couldn't reach the Store Manager.

Please try again.
```

If the response is malformed:

```text
Dolfin received an incomplete response.

No purchase action was taken.
```

If vendor information is unavailable:

```text
I couldn't find a reliable supplier for this product.
```

If purchase order creation fails:

```text
The purchase order could not be created.

Your recommendation is still available.
```

Never display raw API errors to merchants.

---

# 32. Loading States

AI calls may take time.

Use an intelligent loading state:

```text
Dolfin is thinking...
```

Then optionally:

```text
Checking inventory...
```

```text
Analyzing demand...
```

```text
Comparing suppliers...
```

```text
Preparing recommendation...
```

These are UI states only unless the Phinite API actually provides corresponding execution events.

Do not falsely claim that a particular agent has completed a step unless the API response confirms it.

---

# 33. Demo Mode

Support:

```env
DEMO_MODE=true
```

When enabled:

- merchant ID = M001
- deterministic demo data
- deterministic UI examples
- real Phinite requests should still be used if credentials are configured

If Phinite is not configured:

Show a development-only fallback state.

Do not silently fake production behavior.

---

# 34. Demo Dataset

Use approximately:

```text
200 products
20 vendors
12 months sales history
inventory data
vendor catalog
purchase recommendations
```

The frontend does not need to display all 200 products.

Use the most important products for the dashboard.

Example products:

```text
Maggi 12 Pack
Tata Tea 1kg
Aashirvaad Atta 5kg
Surf Excel 2kg
Parle-G 800g
Amul Butter 500g
Fortune Sunflower Oil 1L
Colgate 200g
Dettol 500ml
Britannia Good Day
```

---

# 35. Visual Design

Dolfin should look like a serious SaaS product.

## Style

- Modern
- Minimal
- Premium
- Clean
- Merchant-focused
- Strong typography
- Generous spacing
- Rounded cards
- Subtle borders
- Minimal shadows

Avoid:

- excessive gradients
- excessive animations
- generic AI robot imagery
- cluttered dashboards
- excessive charts

---

# 36. Navigation

Desktop sidebar:

```text
DOLFIN

⌂ Overview
◫ Inventory
▣ Vendors
▤ Procurement
✦ Ask Dolfin

────────────

Store
M001
```

The active page should be clearly highlighted.

---

# 37. Mobile Navigation

On mobile use:

```text
Overview
Inventory
Procurement
Ask Dolfin
```

with a compact bottom navigation or mobile drawer.

The approval flow must work on mobile.

---

# 38. Currency

Use Indian Rupees.

Format:

```text
₹20,000
```

Use `Intl.NumberFormat("en-IN")`.

Never manually concatenate commas.

---

# 39. Date Formatting

Use Indian-friendly formatting.

Example:

```text
12 Sep 2026
```

Do not expose raw ISO timestamps to users.

---

# 40. API Architecture

Frontend:

```text
React component
      ↓
client API helper
      ↓
Next.js route
      ↓
Phinite adapter
      ↓
Phinite API
```

Never:

```text
React component
      ↓
Phinite API
```

---

# 41. API Client

Create:

```text
lib/api.ts
```

Expose:

```typescript
sendAgentMessage()
createPurchaseOrder()
```

Example:

```typescript
export async function sendAgentMessage(
  request: AgentRequest
): Promise<AgentResponse> {
  const response = await fetch("/api/agent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error("Unable to contact Dolfin");
  }

  return response.json();
}
```

---

# 42. Validation

Use Zod for:

- incoming API requests
- normalized Phinite responses
- purchase approval requests

Example:

```typescript
const AgentRequestSchema = z.object({
  message: z.string().min(1),
  merchantId: z.string().min(1),
  conversationId: z.string().optional()
});
```

External API data should be considered untrusted.

---

# 43. Conversation State

Maintain:

```typescript
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;

  inventory?: InventoryResult[];
  vendorRecommendation?: VendorRecommendation;
  procurementRecommendation?: ProcurementRecommendation;

  timestamp: string;
}
```

Conversation state can initially live in the browser.

If Phinite requires a conversation/session identifier, persist it in the frontend session.

---

# 44. Session Handling

When Phinite returns a session/conversation identifier:

Store it.

Subsequent requests should pass it back to Phinite if the API supports conversational continuity.

Example:

```text
First request
conversation_id = null

Phinite
↓
conversation_id = abc123

Next request
conversation_id = abc123
```

---

# 45. Dashboard Data Strategy

Do not make the dashboard depend entirely on chat requests.

The dashboard should have its own data-loading layer.

Possible:

```text
GET /api/dashboard
```

This can initially use demo data.

Later it can consume merchant APIs.

---

# 46. Separation of AI and UI Data

The frontend should distinguish:

### AI-generated

```text
recommendation
reason
priority
vendor recommendation
forecast
```

### Merchant data

```text
product
stock
sales
vendor
price
purchase order
```

Never label fabricated demo data as live merchant data.

In demo mode, optionally display:

```text
DEMO STORE
```

---

# 47. Accessibility

Implement:

- keyboard navigation
- focus states
- accessible modals
- semantic buttons
- proper labels
- sufficient color contrast
- screen-reader-friendly status badges

---

# 48. Performance

The application should:

- use server components where appropriate
- avoid unnecessary client-side JavaScript
- lazy-load heavy charts
- avoid unnecessary API calls
- debounce search inputs
- cache static/demo data

The chat experience should feel fast even if Phinite takes several seconds.

---

# 49. Testing

At minimum test:

## API

```text
POST /api/agent
```

- valid request
- invalid request
- Phinite timeout
- Phinite error
- malformed response

## Procurement

```text
POST /api/purchase-orders
```

- approve
- reject
- duplicate approval
- invalid recommendation

## UI

Test:

```text
Dashboard loads
Chat sends message
Inventory cards render
Vendor comparison renders
Approval modal opens
Approve creates PO
Reject works
Error state renders
```

---

# 50. Primary End-to-End Acceptance Test

This is the most important test.

### Step 1

Open:

```text
/
```

### Step 2

Click:

```text
What should I restock?
```

### Step 3

Frontend calls:

```text
POST /api/agent
```

### Step 4

Next.js calls the supplied Phinite API.

### Step 5

Phinite runs:

```text
Store Manager
      ↓
Inventory Agent
      ↓
Vendor Agent
```

### Step 6

Phinite returns structured recommendation.

### Step 7

Dolfin displays:

```text
Maggi 12 Pack

Stock: 8
Stockout: ~1.3 days

Recommended order:
50 units

Recommended vendor:
Vendor B

₹400/unit
₹20,000 total
2-day delivery
94% reliability
```

### Step 8

Merchant clicks:

```text
Review Purchase
```

### Step 9

Merchant clicks:

```text
Approve Purchase
```

### Step 10

Frontend calls:

```text
POST /api/purchase-orders
```

### Step 11

UI displays:

```text
✓ Purchase Order Created

PO-10024
Vendor B
50 units
₹20,000
```

This is the MVP's primary success criterion.

---

# 51. Important Implementation Constraint

The frontend must NOT duplicate Phinite's intelligence.

For example, do not write frontend logic such as:

```typescript
if (stock < 20) {
  recommendedQuantity = 50;
}
```

unless this is explicitly a demo fallback.

The real recommendation must come from Phinite.

The frontend is responsible for:

```text
displaying
formatting
routing
approval
presentation
```

Phinite is responsible for:

```text
reasoning
agent selection
inventory analysis
vendor analysis
recommendations
```

---

# 52. Handling Multiple Phinite APIs

If the user provides separate endpoints such as:

```text
STORE_MANAGER_API
INVENTORY_API
VENDOR_API
PROCUREMENT_API
```

create an adapter for each.

```text
lib/phinite/
├── store-manager.ts
├── inventory.ts
├── vendors.ts
├── procurement.ts
├── mapper.ts
└── types.ts
```

However, the UI should still communicate through a single normalized interface wherever possible.

---

# 53. API Configuration Documentation

Create:

```text
README.md
```

with:

```text
# Dolfin

## Environment Setup

PHINITE_API_KEY=
PHINITE_AGENT_URL=
DEMO_MODE=true
```

Also document the exact request/response contract after the developer provides it.

Include:

```text
Phinite endpoint
HTTP method
authentication
request body
response body
error responses
timeout
```

Do not document invented values.

---

# 54. Vercel Deployment

The application must be deployable directly to Vercel.

Deployment:

```text
GitHub
   ↓
Vercel
   ↓
Next.js
```

Environment variables should be configured in Vercel.

Never commit:

```text
.env
```

or API credentials.

Commit:

```text
.env.example
```

---

# 55. Production Configuration

Vercel environment:

```text
Production
```

Set:

```text
PHINITE_API_KEY
PHINITE_AGENT_URL
DEMO_MODE
```

as Vercel environment variables.

The application should work without modifying source code.

---

# 56. Future Compatibility

Do not hard-code the architecture around demo data.

Future data sources may include:

```text
Paytm merchant data
POS
Billing
Inventory
Sales
Supplier APIs
ERP
```

The frontend should consume normalized models so that the backend can later replace demo data with live data.

---

# 57. What Codex Should NOT Build

Do not build:

```text
❌ Phinite Agent Graph
❌ Inventory Agent logic
❌ Vendor Agent logic
❌ LLM orchestration
❌ Custom AI model
❌ Paytm backend
❌ Accounting system
❌ Full ERP
❌ Authentication platform
❌ Real supplier marketplace
```

These are outside the frontend MVP.

---

# 58. What Codex MUST Build

```text
✓ Premium Dolfin frontend
✓ Dashboard
✓ AI chat
✓ Inventory view
✓ Vendor comparison
✓ Procurement view
✓ Purchase recommendation UI
✓ Approval flow
✓ Purchase order UI
✓ Next.js API proxy
✓ Phinite integration adapter
✓ Typed API contracts
✓ Error handling
✓ Loading states
✓ Demo mode
✓ Vercel deployment configuration
✓ README
```

---

# 59. Development Sequence

Codex should implement in this order:

### Phase 1

Project setup.

### Phase 2

Global layout and navigation.

### Phase 3

Dashboard.

### Phase 4

Inventory UI.

### Phase 5

Vendor UI.

### Phase 6

Procurement UI.

### Phase 7

Chat UI.

### Phase 8

Next.js API routes.

### Phase 9

Phinite adapter.

### Phase 10

Map actual Phinite response into frontend models.

### Phase 11

Approval flow.

### Phase 12

Error/loading states.

### Phase 13

Responsive design.

### Phase 14

Testing.

### Phase 15

Vercel deployment.

---

# 60. Codex Master Instruction

Give Codex the following instruction together with this document:

> You are building the frontend application for Dolfin.
>
> Dolfin's AI Agent Graph is already being built and deployed separately in Phinite.
>
> Your responsibility is to build a polished Next.js application that consumes the Phinite API endpoints supplied to you.
>
> Do not attempt to recreate the Phinite agents or their reasoning in the frontend.
>
> First inspect the repository.
>
> Then identify the available Phinite endpoint URLs, authentication requirements, request schemas and response schemas.
>
> If these values are provided in environment variables or documentation, use them.
>
> If an endpoint or response schema is missing, do not invent one. Create the appropriate typed adapter interface and clearly identify the missing configuration.
>
> Keep all Phinite communication server-side.
>
> Build a clean adapter layer so that changes to Phinite's response format do not require changes throughout the UI.
>
> Build the complete Dolfin merchant experience:
>
> Dashboard → AI Chat → Inventory → Vendors → Procurement → Approval → Purchase Order.
>
> The primary demo flow must be:
>
> "What should I restock?"
>
> → Phinite
>
> → Inventory Agent
>
> → Vendor Agent
>
> → procurement recommendation
>
> → merchant approval
>
> → purchase order created.
>
> The UI must feel like a real SaaS product rather than an admin dashboard.
>
> Use Next.js, React, TypeScript, Tailwind, shadcn/ui and Lucide.
>
> Use Zod for API validation.
>
> Do not expose Phinite credentials.
>
> Do not hardcode AI recommendations in the production path.
>
> Do not allow purchase-order creation without explicit user approval.
>
> Use deterministic demo data where a real merchant data source is not yet available.
>
> Make the final application deployable directly to Vercel.
>
> After implementation, verify the complete end-to-end flow and provide a README explaining local setup, environment variables, Phinite integration, testing and Vercel deployment.

---

# 61. Final Definition of Done

Dolfin is complete when a merchant can open the deployed Vercel application and experience:

```text
                  DOLFIN
            AI STORE MANAGER
                    │
                    ▼
             "What should I
               restock?"
                    │
                    ▼
              PHINITE GRAPH
                    │
             ┌──────┴──────┐
             ▼             ▼
         INVENTORY       VENDOR
           AGENT         AGENT
             │             │
             └──────┬──────┘
                    ▼
              RECOMMENDATION
                    │
                    ▼
               REVIEW PO
                    │
                    ▼
                 APPROVE
                    │
                    ▼
              PO CREATED ✓
```

The merchant should never need to understand that multiple AI agents are operating behind the scenes.

The product experience should simply feel like:

> **"I have an AI store manager who knows what I need to buy and helps me buy it."**

That is the MVP.