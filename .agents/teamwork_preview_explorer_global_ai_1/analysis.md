# Codebase Discovery & Technical Analysis: Global AI Assistant Implementation

This report details the codebase discovery, data schemas, current AI implementations, and a comprehensive technical strategy to implement the "Global AI Assistant" feature in the React application.

---

## 1. Observations

### 1.1 Existing Routing and Views Structure
- **Location**: `src/App.jsx`
- **Routing Mechanism**: The application does not use React Router or any external routing library. Instead, it relies on local state `currentView` in `App.jsx` (lines 9-10):
  ```javascript
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'client', 'clients'
  const [selectedClientId, setSelectedClientId] = useState(null);
  ```
- **Views**:
  1. **Dashboard**: Managed by `HomeView.jsx` (rendered at line 141 in `App.jsx`). Displays a list of pending procedures from the `entradas` table.
  2. **Client View**: Managed by `ClientView.jsx` (rendered at line 142 in `App.jsx`). Displays a single client's operational details, uploaded documents, procedure history, and relations.
  3. **Client List View**: Managed by `ClientListView.jsx` (rendered at line 143 in `App.jsx`). Lists all clients with support for filtering using a `globalSearch` query.

### 1.2 Existing AI/Groq Services & Supabase Client
- **Supabase Client**: `src/supabaseClient.js` creates and exports a singleton client (line 10):
  ```javascript
  export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseSecretKey || 'placeholder')
  ```
- **AI Services**:
  - `src/services/aiService.js`: Central service invoking Groq's chat completion endpoint:
    ```javascript
    const GROQ_BASE_URL  = 'https://api.groq.com/openai/v1/chat/completions';
    const MODEL_TEXT     = 'llama-3.3-70b-versatile';   // General text/reasoning model
    const MODEL_VISION   = 'llama-3.2-11b-vision-preview'; // Vision & OCR model
    ```
    Key functions:
    - `analyzeDocumentImage(file)` (lines 71-116): Performs OCR extraction from document images.
    - `chat(messages, temperature)` (lines 127-129): General completion.
    - `chatWithClientContext(userMessage, chatHistory, supabaseContext, crmContext)` (lines 141-166): RAG chat loaded with client-specific databases and CRM context.
    - `extractClientDataFromText(text)` (lines 176-204): Structuring raw copy-paste text.
    - `suggestNextStep(tramite, cliente)` (lines 215-225): Predicts operational actions.
  - `src/services/groqService.js`: Contains a standalone duplicate of `analyzeDocumentImage` using `llama-3.2-11b-vision-preview`.

### 1.3 CRM Queries and Data Schemas
- **CRM Integration Webhook**: `src/services/crmBridgeService.js` (lines 6-42) queries a n8n webhook:
  ```javascript
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_crm: idCrm })
  });
  ```
  It sends the CRM ID (`id_kommo` or `id_crm`) and expects back a conversational history log (returned as `data.historial`).
- **Database Tables**:
  - `clientes`: Primary client data (`id`, `nombre`, `cpf`, `email`, `telefono`, `ciudad`, `estado_cliente`, etc.).
  - `entradas`: Active and completed procedures (`id`, `id_cliente`, `servicio`, `estado_tramite`, `creado_en`, `operario`).
  - `cliente_datos_operacionales`: EAV-style table storing custom fields (`id_cliente`, `campo_id`, `valor`).
  - `relaciones_clientes`: Links between clients (`cliente_id`, `cliente_relacionado_id`, `tipo_relacion`).
  - `documentos_operacionales`: Metadata of uploaded files (`id_cliente`, `nombre_archivo`, `url_archivo`, `estado`).
  - `ai_chats`: Scoped chat logs for single-client views (`cliente_id`, `role`, `content`).

### 1.4 AI Chat UI Layout and Styling
- **ClientView.jsx AI Chat**: Rendered in a fixed-width right sidebar inside `ClientView.jsx` (lines 964-1019).
- **Styling Details**:
  - Main container: `width: '400px', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--color-bg-base)', borderLeft: '1px solid var(--color-border)', overflow: 'hidden'`.
  - Message bubble: User bubbles are styled with `var(--color-primary)` background and white text, while assistant bubbles are styled with `var(--color-bg-elevated)` background and `var(--color-text-primary)` text.
  - Input section: Textarea with enter key handler and circular primary send button containing Lucide's `Send` icon.

### 1.5 React Context & State Management
- There is currently **no React Context** or global state manager (Redux/Zustand) configured in the codebase.
- State is managed locally inside components and passed down via props. Toggling views causes components like `ClientView.jsx` to mount/unmount, wiping out their local UI and chat states.

---

## 2. Logic Chain

### 2.1 Persisting Chat History
1. **Observation**: When switching views via `currentView` in `App.jsx`, components mount and unmount. For example, navigating from `ClientView` back to `HomeView` and then back to `ClientView` completely rebuilds the component state.
2. **Inference**: Storing chat history in `ClientView` local state causes it to be lost upon view changes.
3. **Conclusion**: We must implement a React Context Provider (`GlobalAiChatContext`) at the root layout of the app (wrapping the layout inside `App.jsx`) to maintain the Assistant's open/close state, chat history, and loading states globally.

### 2.2 Reusing Visual Components for Overlay Drawer
1. **Observation**: The AI Chat in `ClientView.jsx` has a beautiful layout that fits nicely inside a flex-column format.
2. **Inference**: The exact same layout, styling classes (like `.glass-panel`, `.btn-primary`, and custom scrollbars), and Lucide icons can be extracted to a new component.
3. **Conclusion**: We will create `GlobalAiChat.jsx` rendering a Floating Action Button (FAB) at the bottom-right, which toggles a fixed-position drawer overlaying the screen.

### 2.3 Securing Database Access via Safe JS Tool Functions
1. **Observation**: Injecting the entire database or passing raw SQL prompts to an LLM exposes the application to massive token overhead, data breaches, and prompt injection attacks.
2. **Inference**: Limiting the LLM to predefined safe queries exposed as tools prevents raw database exposure.
3. **Conclusion**: We will implement three safe JavaScript utility functions:
   - `searchClientsByName(name)`: Executes a scoped `.ilike` filter on `clientes`.
   - `countPendingProcedures()`: Counts rows in `entradas` where `estado_tramite === 'pendiente'`.
   - `getOverallStats()`: Calculates aggregate client count and counts procedures by status.
   These will be declared as Groq-compatible functions/tools.

---

## 3. Caveats
- **Groq API Tool-Calling Support**: Groq's tool-calling support is model-dependent. While `llama-3.3-70b-versatile` supports tool calling natively, if there are Groq service rate limits or version differences, fallback error handling must be provided.
- **Offline / Mock Mode**: Since we are in `CODE_ONLY` mode and cannot reach the internet, we assume testing will require a mock environment for external fetch operations (e.g. mock Groq API calls).
- **Client Chat Sidebar vs Global Chat**: The requirements state that the Global AI Assistant should be overlaid on any screen. We should retain the individual client profile chat or let the global chat dynamically focus on the active client if the user is on the `ClientView` screen. The best approach is to make the Global Assistant smart enough to know which client is currently viewed by checking the active layout parameters.

---

## 4. Conclusion & Technical Strategy

### 4.1 System Architecture

```
                  +--------------------------+
                  |    GlobalAiChatContext   | <---+ Manage chat state & history
                  +--------------------------+     |
                               |                   |
                  +------------v-------------+     |
                  |       GlobalAiChat       | ----+ Renders FAB & Overlay Drawer
                  +------------+-------------+
                               |
                   Invokes API with Tool Calls
                               |
                  +------------v-------------+
                  |         aiService        |
                  +------------+-------------+
                               |
                   Maps Tool Calls to JS Functions
                               |
                  +------------v-------------+
                  |         dbTools          | <---+ Executes safe Supabase queries
                  +--------------------------+
```

### 4.2 Data Tools Definition (Safe JS Functions)
To be added to `src/services/aiService.js` (or a dedicated `src/services/dbTools.js` and imported):

```javascript
import { supabase } from '../supabaseClient';

/**
 * Searches clients by name using case-insensitive partial match.
 */
export async function searchClientsByName(name) {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, cpf, email, telefono, estado_cliente')
      .ilike('nombre', `%${name}%`);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error in searchClientsByName:', err);
    return { error: err.message };
  }
}

/**
 * Counts all pending procedures.
 */
export async function countPendingProcedures() {
  try {
    const { count, error } = await supabase
      .from('entradas')
      .select('*', { count: 'exact', head: true })
      .eq('estado_tramite', 'pendiente');
    if (error) throw error;
    return { pendingCount: count };
  } catch (err) {
    console.error('Error in countPendingProcedures:', err);
    return { error: err.message };
  }
}

/**
 * Computes system-wide aggregate stats.
 */
export async function getOverallStats() {
  try {
    // 1. Total clients
    const { count: totalClients, error: errClients } = await supabase
      .from('clientes')
      .select('*', { count: 'exact', head: true });
    if (errClients) throw errClients;

    // 2. Total procedures
    const { count: totalProcedures, error: errProc } = await supabase
      .from('entradas')
      .select('*', { count: 'exact', head: true });
    if (errProc) throw errProc;

    // 3. Breakdown by status
    const { data: statusStats, error: errStatus } = await supabase
      .from('entradas')
      .select('estado_tramite');
    if (errStatus) throw errStatus;

    const statusCounts = (statusStats || []).reduce((acc, curr) => {
      const status = curr.estado_tramite || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalClients,
      totalProcedures,
      statusCounts
    };
  } catch (err) {
    console.error('Error in getOverallStats:', err);
    return { error: err.message };
  }
}
```

### 4.3 Groq Tool-Calling Refactoring (`aiService.js`)
We will add `chatWithTools(chatHistory)` which supports Groq function calling recursively:

```javascript
/**
 * Sends a chat history to Groq, executing tool calls when requested.
 * @param {Array} chatHistory - Previous messages
 * @returns {Promise<string>} Final response from assistant
 */
export async function chatWithTools(chatHistory) {
  const apiKey = getApiKey();
  const systemPrompt = `Eres un asistente inteligente para una agencia de gestión migratoria en Brasil.
Tienes acceso a la base de datos a través de herramientas/funciones especiales.
Si el usuario te pregunta sobre clientes, trámites o estadísticas generales, utiliza la herramienta adecuada para responder con datos precisos.
Siempre explica brevemente qué datos encontraste o procesaste. Responde en español de manera profesional y clara.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory
  ];

  const tools = [
    {
      type: "function",
      function: {
        name: "searchClientsByName",
        description: "Busca clientes en la base de datos por su nombre de forma parcial (insensible a mayúsculas/minúsculas).",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "El nombre o parte del nombre del cliente a buscar."
            }
          },
          required: ["name"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "countPendingProcedures",
        description: "Obtiene el conteo total de trámites que se encuentran en estado 'pendiente'."
      }
    },
    {
      type: "function",
      function: {
        name: "getOverallStats",
        description: "Obtiene estadísticas generales del sistema, incluyendo cantidad total de clientes, trámites totales y conteo por estado de trámite."
      }
    }
  ];

  const res = await fetch(GROQ_BASE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL_TEXT,
      messages: messages,
      tools: tools,
      tool_choice: "auto",
      temperature: 0.3
    }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Groq HTTP ${res.status} — ${res.statusText}`);
  }

  const data = await res.json();
  const assistantMessage = data.choices?.[0]?.message;

  if (!assistantMessage) {
    throw new Error("No response message from Groq.");
  }

  // Handle tool calls recursively
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    const updatedHistory = [...chatHistory, assistantMessage];

    for (const toolCall of assistantMessage.tool_calls) {
      const name = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || '{}');

      let result;
      if (name === "searchClientsByName") {
        result = await searchClientsByName(args.name);
      } else if (name === "countPendingProcedures") {
        result = await countPendingProcedures();
      } else if (name === "getOverallStats") {
        result = await getOverallStats();
      } else {
        result = { error: `Tool not supported: ${name}` };
      }

      updatedHistory.push({
        role: "tool",
        tool_call_id: toolCall.id,
        name: name,
        content: JSON.stringify(result)
      });
    }

    return chatWithTools(updatedHistory);
  }

  return assistantMessage.content || '';
}
```

### 4.4 React Context Definition (`GlobalAiChatContext.jsx`)
Create `src/context/GlobalAiChatContext.jsx`:

```javascript
import { createContext, useContext, useState, useCallback } from 'react';
import { chatWithTools } from '../services/aiService';

const GlobalAiChatContext = createContext(null);

export function GlobalAiChatProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de operaciones global. Puedo buscar clientes, consultar estadísticas de trámites, o ayudarte a gestionar tu flujo de trabajo. ¿En qué te puedo ayudar hoy?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;
    const userMsg = text.trim();
    setInput('');
    setIsLoading(true);

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);

    try {
      const reply = await chatWithTools(newMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ocurrió un error al contactar a la IA.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([
      { role: 'assistant', content: '¡Hola! Soy tu asistente de operaciones global. ¿En qué te puedo ayudar hoy?' }
    ]);
  }, []);

  return (
    <GlobalAiChatContext.Provider value={{
      isOpen,
      setIsOpen,
      messages,
      isLoading,
      input,
      setInput,
      sendMessage,
      clearChat
    }}>
      {children}
    </GlobalAiChatContext.Provider>
  );
}

export function useGlobalAiChat() {
  const context = useContext(GlobalAiChatContext);
  if (!context) {
    throw new Error('useGlobalAiChat must be used within a GlobalAiChatProvider');
  }
  return context;
}
```

### 4.5 Global Assistant Component (`GlobalAiChat.jsx`)
Create `src/components/GlobalAiChat.jsx` to render the Floating Action Button and Chat Drawer:

```javascript
import { useGlobalAiChat } from '../context/GlobalAiChatContext';
import { MessageSquare, X, Send, Sparkles, Loader2 } from 'lucide-react';

export default function GlobalAiChat() {
  const { isOpen, setIsOpen, messages, isLoading, input, setInput, sendMessage } = useGlobalAiChat();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <>
      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          border: 'none',
          cursor: 'pointer',
          zIndex: 1000,
          transition: 'all 0.2s ease-in-out',
        }}
        className="fab-hover"
        title="Abrir Asistente IA"
      >
        {isOpen ? <X size={24} color="white" /> : <MessageSquare size={24} color="white" />}
      </button>

      {/* Chat Drawer Overlay */}
      {isOpen && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '400px',
            height: '600px',
            maxHeight: 'calc(100vh - 120px)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-primary)' }}>
              <Sparkles size={20} />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Asistente IA Global</h2>
            </div>
            <button className="btn btn-ghost" style={{ padding: '0.25rem' }} onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                  {msg.role === 'user' ? 'Tú' : 'IA'}
                </div>
                <div style={{
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                  color: msg.role === 'user' ? 'white' : 'var(--color-text-primary)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-lg)',
                  borderBottomRightRadius: msg.role === 'user' ? 0 : 'var(--radius-lg)',
                  borderBottomLeftRadius: msg.role === 'assistant' ? 0 : 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ alignSelf: 'flex-start', background: 'var(--color-bg-elevated)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', borderBottomLeftRadius: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Loader2 size={16} className="animate-spin" color="var(--color-primary)" />
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Buscando en la base de datos...</span>
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta sobre clientes, trámites pendientes o estadísticas..."
                style={{ flex: 1, resize: 'none', height: '42px', minHeight: '42px', padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)' }}
                disabled={isLoading}
              />
              <button
                className="btn btn-primary"
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
                style={{ width: '42px', height: '42px', padding: 0, borderRadius: '50%', flexShrink: 0 }}
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### 4.6 Concrete List of Target Locations to Modify/Create

1. **Create `src/context/GlobalAiChatContext.jsx`**: Implement global state management.
2. **Create `src/components/GlobalAiChat.jsx`**: Build the visual FAB and drawer overlay.
3. **Modify `src/services/aiService.js`**:
   - Add `import { supabase } from '../supabaseClient';`
   - Implement `searchClientsByName(name)`, `countPendingProcedures()`, and `getOverallStats()`.
   - Implement `chatWithTools(chatHistory)` utilizing Groq function calling syntax.
4. **Modify `src/App.jsx`**:
   - Wrap the main application component with `<GlobalAiChatProvider>`.
   - Mount `<GlobalAiChat />` inside the root container.
5. **Add CSS styles in `src/index.css`**:
   - Add a `.fab-hover:hover { transform: scale(1.05); }` style.

---

## 5. Verification Method

To verify the implementation independently, follow these steps:

### 5.1 Linting
Execute the project's fast linter to confirm code validity:
```bash
npm run lint
```
*(Verify that there are no syntax or Oxlint errors on the newly created Context or Component files.)*

### 5.2 Functional Verification Scripts
Create a mock testing script `test/toolCall.test.js` to run locally via Node:
```javascript
import { chatWithTools } from '../src/services/aiService';

// Mock chat history requesting overall statistics
const mockHistory = [
  { role: 'user', content: '¿Cuáles son las estadísticas generales de los trámites?' }
];

async function run() {
  console.log('Testing Groq Tool Call integration...');
  try {
    const response = await chatWithTools(mockHistory);
    console.log('Response:', response);
    if (response && response.length > 0) {
      console.log('SUCCESS: Tool call completed and resolved!');
    } else {
      console.log('FAIL: Empty response.');
    }
  } catch (err) {
    console.error('FAIL: Error during execution:', err.message);
  }
}
run();
```
Run using:
```bash
node test/toolCall.test.js
```
*(Ensure all tool mappings execute correctly, retrieve data via Supabase, and get formatted response back from Groq).*
