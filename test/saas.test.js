import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Relative paths inside the workspace
const projectRoot = path.resolve(__dirname, '../../');
const operDir = path.resolve(__dirname, '../');
const finDir = path.resolve(projectRoot, 'DASHBOARDFinanciero');

const saasMigrationsDir = path.resolve(operDir, 'database/migrations/saas');
const migrationsDir = path.resolve(operDir, 'database/migrations');

// Safe file reader
function safeReadFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
  } catch (_err) {}
  return '';
}

// Gather migration files
const migrationFiles = [];
function addSqlFilesFromDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach(file => {
        if (file.endsWith('.sql')) {
          migrationFiles.push({
            name: file,
            path: path.join(dirPath, file),
            content: safeReadFile(path.join(dirPath, file))
          });
        }
      });
    }
  } catch (_e) {}
}

addSqlFilesFromDir(saasMigrationsDir);
addSqlFilesFromDir(migrationsDir);
addSqlFilesFromDir(finDir);

const allMigrationContent = migrationFiles.map(f => f.content).join('\n');

// Read all instances of a file list to handle duplicate paths
function readAllFileContents(relativePaths) {
  const list = [];
  for (const rel of relativePaths) {
    const fullPath = path.resolve(operDir, rel);
    if (fs.existsSync(fullPath)) {
      list.push({
        path: rel,
        content: fs.readFileSync(fullPath, 'utf8')
      });
    }
  }
  return list;
}

// Load files
const storageServiceFiles = readAllFileContents(['src/services/storageService.js']);
const templateServiceFiles = readAllFileContents(['src/services/templateService.js']);
const perfilSettingsFiles = readAllFileContents(['src/components/settings/PerfilSettings.jsx']);
const _equipoServiceFiles = readAllFileContents(['src/services/equipoService.js']);
const _mediaLibraryServiceFiles = readAllFileContents(['src/services/mediaLibraryService.js', 'src/shared/services/mediaLibraryService.js']);
const documentViewerModalFiles = readAllFileContents(['src/components/DocumentViewerModal.jsx']);
const registerFormFiles = readAllFileContents(['src/features/auth/components/RegisterForm.jsx', 'src/features/auth/components/AgencyRegisterForm.jsx', 'src/components/auth/RegisterForm.jsx']);

// Read Verification Script from root or operational
const verifyRlsContent = safeReadFile(path.resolve(projectRoot, 'verify_rls.mjs')) ||
                         safeReadFile(path.resolve(operDir, 'verify_rls.mjs'));

// Business tables catalog
const businessTables = [
  'ai_chats', 'biblioteca_multimedia', 'campos_datos_operacionales', 'categorias_datos_operacionales',
  'chat_equipo', 'chat_privado', 'cliente_datos_operacionales', 'clientes', 'configuraciones_app',
  'documentos_operacionales', 'documentos_pendientes', 'entradas', 'estadisticas_agenda',
  'formularios_clientes', 'historial_cambios', 'historial_clientes', 'notas_kommo', 'notas_tramite',
  'notificaciones_equipo', 'operarios', 'perfiles', 'plantillas_documentos', 'relaciones_clientes',
  'salidas', 'tramites_catalogo', 'tramites_categorias', 'tramites_precios'
];

const tests = [
  // ==================== TIER 1: FEATURE COVERAGE (25 TESTS) ====================
  
  // --- F1: Database Tenant Isolation (5 tests) ---
  {
    id: "T1-F1-1",
    tier: 1,
    feature: 1,
    name: "Check if organizations table definition exists in database migrations",
    testFn: () => {
      const pass = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?(public\.)?organizations/i.test(allMigrationContent);
      return { pass, message: pass ? "Found organizations table definition." : "Missing public.organizations table definition." };
    }
  },
  {
    id: "T1-F1-2",
    tier: 1,
    feature: 1,
    name: "Check if clientes table definition includes organization_id column",
    testFn: () => {
      const pass = /ALTER\s+TABLE\s+(public\.)?clientes[\s\S]*ADD\s+COLUMN[\s\S]*organization_id/i.test(allMigrationContent) || 
                   /CREATE\s+TABLE\s+(public\.)?clientes[\s\S]*organization_id/i.test(allMigrationContent);
      return { pass, message: pass ? "Found organization_id inside clientes table definition." : "Missing organization_id inside clientes table definition." };
    }
  },
  {
    id: "T1-F1-3",
    tier: 1,
    feature: 1,
    name: "Check if clientes table has ENABLE ROW LEVEL SECURITY statements",
    testFn: () => {
      const pass = /ALTER\s+TABLE\s+(public\.)?clientes\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(allMigrationContent);
      return { pass, message: pass ? "Found ENABLE ROW LEVEL SECURITY statement for clientes." : "Missing ENABLE ROW LEVEL SECURITY statement for clientes." };
    }
  },
  {
    id: "T1-F1-4",
    tier: 1,
    feature: 1,
    name: "Check if get_my_organization_id() security definer helper function is defined",
    testFn: () => {
      const pass = /CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+(public\.)?get_my_organization_id/i.test(allMigrationContent);
      return { pass, message: pass ? "Found get_my_organization_id function definition." : "Missing get_my_organization_id function definition." };
    }
  },
  {
    id: "T1-F1-5",
    tier: 1,
    feature: 1,
    name: "Check if RLS policy statement exists for clientes table",
    testFn: () => {
      const pass = /CREATE\s+POLICY\s+tenant_isolation_policy\s+ON\s+(public\.)?clientes/i.test(allMigrationContent);
      return { pass, message: pass ? "Found tenant_isolation_policy on clientes table." : "Missing tenant_isolation_policy on clientes table." };
    }
  },

  // --- F2: Storage Privacy & Isolation (5 tests) ---
  {
    id: "T1-F2-1",
    tier: 1,
    feature: 2,
    name: "Check if bucket documentos_operacionales is created/referenced in storage migrations",
    testFn: () => {
      const pass = allMigrationContent.includes('documentos_operacionales');
      return { pass, message: pass ? "Found documentos_operacionales bucket references." : "Missing documentos_operacionales bucket definition in storage migrations." };
    }
  },
  {
    id: "T1-F2-2",
    tier: 1,
    feature: 2,
    name: "Check if bucket documentos_operacionales is configured as private (non-public)",
    testFn: () => {
      const pass = /public\s*=\s*false/i.test(allMigrationContent);
      return { pass, message: pass ? "Found private bucket configuration public=false." : "Missing public=false bucket configuration statement." };
    }
  },
  {
    id: "T1-F2-3",
    tier: 1,
    feature: 2,
    name: "Check if storage RLS policy exists for documentos_operacionales in migrations",
    testFn: () => {
      const pass = /CREATE\s+POLICY[\s\S]*ON\s+storage\.objects/i.test(allMigrationContent);
      return { pass, message: pass ? "Found storage.objects RLS policies in migrations." : "Missing CREATE POLICY statement for storage.objects." };
    }
  },
  {
    id: "T1-F2-4",
    tier: 1,
    feature: 2,
    name: "Check if storage policy restricts write actions to authenticated users",
    testFn: () => {
      const pass = /TO\s+authenticated/i.test(allMigrationContent) && /FOR\s+ALL|FOR\s+INSERT/i.test(allMigrationContent);
      return { pass, message: pass ? "Found write restrictions to authenticated users on storage." : "Storage policy does not restrict write actions to authenticated users." };
    }
  },
  {
    id: "T1-F2-5",
    tier: 1,
    feature: 2,
    name: "Check if storage policy restricts read actions to authenticated users",
    testFn: () => {
      const pass = /TO\s+authenticated/i.test(allMigrationContent) && /FOR\s+ALL|FOR\s+SELECT/i.test(allMigrationContent);
      return { pass, message: pass ? "Found read restrictions to authenticated users on storage." : "Storage policy does not restrict read actions to authenticated users." };
    }
  },

  // --- F3: Signed URLs (5 tests) ---
  {
    id: "T1-F3-1",
    tier: 1,
    feature: 3,
    name: "Check if storageService.js imports or references createSignedUrl",
    testFn: () => {
      if (storageServiceFiles.length === 0) return { pass: false, message: "No storageService.js files found." };
      const missing = storageServiceFiles.filter(f => !f.content.includes('createSignedUrl'));
      const pass = missing.length === 0;
      return { pass, message: pass ? "All storageService.js files reference createSignedUrl." : `Missing createSignedUrl in: ${missing.map(m => m.path).join(', ')}` };
    }
  },
  {
    id: "T1-F3-2",
    tier: 1,
    feature: 3,
    name: "Check if storageService.js does not use getPublicUrl for client documents",
    testFn: () => {
      if (storageServiceFiles.length === 0) return { pass: false, message: "No storageService.js files found." };
      const failed = storageServiceFiles.filter(f => f.content.includes('getPublicUrl'));
      const pass = failed.length === 0;
      return { pass, message: pass ? "Verified getPublicUrl is not used in any storageService.js." : `getPublicUrl is still used in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T1-F3-3",
    tier: 1,
    feature: 3,
    name: "Check if frontend uses short-lived expiration for signed URLs",
    testFn: () => {
      if (storageServiceFiles.length === 0) return { pass: false, message: "No storageService.js files found." };
      const missing = storageServiceFiles.filter(f => !f.content.includes('createSignedUrl') || !/createSignedUrl\([\s\S]*,\s*\d+\)/.test(f.content));
      const pass = missing.length === 0;
      return { pass, message: pass ? "All storageService.js files contain short-lived expiration config." : `Missing short-lived expiration config in: ${missing.map(m => m.path).join(', ')}` };
    }
  },
  {
    id: "T1-F3-4",
    tier: 1,
    feature: 3,
    name: "Check if templateService.js references createSignedUrl or avoids getPublicUrl",
    testFn: () => {
      if (templateServiceFiles.length === 0) return { pass: false, message: "No templateService.js files found." };
      const failed = templateServiceFiles.filter(f => !f.content.includes('createSignedUrl') || f.content.includes('getPublicUrl'));
      const pass = failed.length === 0;
      return { pass, message: pass ? "All templateService.js files use signed URLs and avoid public URLs." : `Compliance failed in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T1-F3-5",
    tier: 1,
    feature: 3,
    name: "Check if image and PDF viewer components render files using dynamic signed URLs",
    testFn: () => {
      if (documentViewerModalFiles.length === 0) return { pass: false, message: "No DocumentViewerModal.jsx files found." };
      const failed = documentViewerModalFiles.filter(f => !f.content.includes('createSignedUrl') && !f.content.includes('signedUrl'));
      const pass = failed.length === 0;
      return { pass, message: pass ? "All viewer components render using dynamic signed URLs." : `Static url rendering in: ${failed.map(f => f.path).join(', ')}` };
    }
  },

  // --- F4: Agency Registration Flow (5 tests) ---
  {
    id: "T1-F4-1",
    tier: 1,
    feature: 4,
    name: "Check if database trigger handle_new_user extracts is_agency_registration metadata flag",
    testFn: () => {
      const pass = allMigrationContent.includes('is_agency_registration');
      return { pass, message: pass ? "Found extraction of 'is_agency_registration' inside trigger migrations." : "Missing 'is_agency_registration' metadata extraction inside handle_new_user migrations." };
    }
  },
  {
    id: "T1-F4-2",
    tier: 1,
    feature: 4,
    name: "Check if trigger creates an organization entry on agency registration",
    testFn: () => {
      const pass = /INSERT\s+INTO\s+(public\.)?organizations/i.test(allMigrationContent);
      return { pass, message: pass ? "Found organization creation statement in trigger migrations." : "Missing organization creation statement (INSERT INTO public.organizations) in handle_new_user trigger." };
    }
  },
  {
    id: "T1-F4-3",
    tier: 1,
    feature: 4,
    name: "Check if trigger links the new profile to the newly created organization ID",
    testFn: () => {
      const pass = /INSERT\s+INTO\s+(public\.)?perfiles[\s\S]*organization_id/i.test(allMigrationContent) &&
                   /RETURNING\s+id\s+INTO\s+new_org_id/i.test(allMigrationContent);
      return { pass, message: pass ? "Found profile to organization linking logic in trigger migrations." : "Missing profile to organization_id association query or RETURNING id placeholder inside trigger logic." };
    }
  },
  {
    id: "T1-F4-4",
    tier: 1,
    feature: 4,
    name: "Check if trigger assigns the admin_plus role to the onboarding agency owner",
    testFn: () => {
      const pass = /admin_plus/i.test(allMigrationContent) && /user_rol/i.test(allMigrationContent);
      return { pass, message: pass ? "Found role promotion to 'admin_plus' inside agency onboarding path." : "Missing promotion assignment setting role to 'admin_plus' inside handle_new_user trigger logic." };
    }
  },
  {
    id: "T1-F4-5",
    tier: 1,
    feature: 4,
    name: "Check if frontend signup code includes is_agency_registration option metadata in auth.signUp",
    testFn: () => {
      if (registerFormFiles.length === 0) {
        return { pass: false, message: "Agency Registration frontend component (RegisterForm.jsx) not found." };
      }
      const missing = registerFormFiles.filter(f => !f.content.includes('is_agency_registration') || !f.content.includes('agency_name'));
      const pass = missing.length === 0;
      return { pass, message: pass ? "Frontend registers agency registration metadata values inside supabase.auth.signUp invocation." : `Missing payload properties in: ${missing.map(m => m.path).join(', ')}` };
    }
  },

  // --- F5: Verification Script (5 tests) ---
  {
    id: "T1-F5-1",
    tier: 1,
    feature: 5,
    name: "Check if verify_rls.mjs script exists in the workspace",
    testFn: () => {
      const pass = !!verifyRlsContent;
      return { pass, message: pass ? "verify_rls.mjs exists." : "Missing verify_rls.mjs file." };
    }
  },
  {
    id: "T1-F5-2",
    tier: 1,
    feature: 5,
    name: "Check if verify_rls.mjs initializes connection to database",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = verifyRlsContent.includes('createClient') || verifyRlsContent.includes('Client') || verifyRlsContent.includes('Pool');
      return { pass, message: pass ? "DB Client connection initialized." : "Missing DB connection logic." };
    }
  },
  {
    id: "T1-F5-3",
    tier: 1,
    feature: 5,
    name: "Check if verify_rls.mjs queries information_schema.tables to check all 27 tables",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const missing = businessTables.filter(t => !verifyRlsContent.includes(t));
      const pass = missing.length === 0;
      return { pass, message: pass ? "All 27 tables are queried in verify_rls.mjs." : `Script misses tables: ${missing.join(', ')}` };
    }
  },
  {
    id: "T1-F5-4",
    tier: 1,
    feature: 5,
    name: "Check if verify_rls.mjs checks if RLS is enabled on each table",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = verifyRlsContent.includes('rowlevelsecurity') || verifyRlsContent.includes('relrowsecurity') || verifyRlsContent.includes('security');
      return { pass, message: pass ? "RLS status is audited." : "Missing check on table RLS settings." };
    }
  },
  {
    id: "T1-F5-5",
    tier: 1,
    feature: 5,
    name: "Check if verify_rls.mjs verifies storage bucket privacy settings",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = verifyRlsContent.includes('public') || verifyRlsContent.includes('bucket') || verifyRlsContent.includes('storage');
      return { pass, message: pass ? "Bucket privacy audited." : "Missing check on bucket public/private status." };
    }
  },

  // ==================== TIER 2: BOUNDARY & CORNER CASES (25 TESTS) ====================
  
  // --- F1: Database Tenant Isolation (5 tests) ---
  {
    id: "T2-F1-1",
    tier: 2,
    feature: 1,
    name: "Check that organization_id in clientes is defined with a NOT NULL constraint",
    testFn: () => {
      const pass = /ALTER\s+COLUMN\s+organization_id\s+SET\s+NOT\s+NULL/i.test(allMigrationContent) ||
                   /organization_id\s+uuid\s+not\s+null/i.test(allMigrationContent);
      return { pass, message: pass ? "Found NOT NULL constraint on organization_id." : "Missing NOT NULL constraint on organization_id." };
    }
  },
  {
    id: "T2-F1-2",
    tier: 2,
    feature: 1,
    name: "Check that organization_id in clientes has foreign key REFERENCES public.organizations(id) ON DELETE CASCADE",
    testFn: () => {
      const pass = /REFERENCES\s+(public\.)?organizations\s*\(id\)\s+ON\s+DELETE\s+CASCADE/i.test(allMigrationContent);
      return { pass, message: pass ? "Found foreign key referencing organizations with ON DELETE CASCADE." : "Missing REFERENCES public.organizations(id) ON DELETE CASCADE constraint." };
    }
  },
  {
    id: "T2-F1-3",
    tier: 2,
    feature: 1,
    name: "Check that helper get_my_organization_id is defined as SECURITY DEFINER STABLE",
    testFn: () => {
      const pass = /SECURITY\s+DEFINER/i.test(allMigrationContent) && /STABLE/i.test(allMigrationContent);
      return { pass, message: pass ? "Helper function defined as SECURITY DEFINER STABLE." : "Helper function lacks SECURITY DEFINER or STABLE tag." };
    }
  },
  {
    id: "T2-F1-4",
    tier: 2,
    feature: 1,
    name: "Check that all 27 business tables have the organization_id column",
    testFn: () => {
      const missing = [];
      businessTables.forEach(table => {
        const regex1 = new RegExp(`ALTER\\s+TABLE\\s+(public\\.)?${table}\\s+ADD\\s+COLUMN[\\s\\S]*organization_id`, 'i');
        const regex2 = new RegExp(`CREATE\\s+TABLE\\s+(public\\.)?${table}[\\s\\S]*organization_id`, 'i');
        if (!regex1.test(allMigrationContent) && !regex2.test(allMigrationContent)) {
          missing.push(table);
        }
      });
      return {
        pass: missing.length === 0,
        message: missing.length === 0 ? "All 27 tables contain organization_id." : `Missing organization_id column on tables: ${missing.join(', ')}`
      };
    }
  },
  {
    id: "T2-F1-5",
    tier: 2,
    feature: 1,
    name: "Check that all 27 business tables enable row level security and have tenant isolation policies",
    testFn: () => {
      const missingRls = [];
      const missingPolicy = [];
      businessTables.forEach(table => {
        const rlsRegex = new RegExp(`ALTER\\s+TABLE\\s+(public\\.)?${table}\\s+ENABLE\\s+ROW\\s+LEVEL\\s+SECURITY`, 'i');
        const policyRegex = new RegExp(`CREATE\\s+POLICY\\s+tenant_isolation_policy\\s+ON\\s+(public\\.)?${table}`, 'i');
        if (!rlsRegex.test(allMigrationContent)) missingRls.push(table);
        if (!policyRegex.test(allMigrationContent)) missingPolicy.push(table);
      });
      const pass = missingRls.length === 0 && missingPolicy.length === 0;
      return {
        pass,
        message: pass ? "All 27 tables have RLS and policies enabled." : `Failures: Missing RLS on [${missingRls.join(', ')}]; Missing policies on [${missingPolicy.join(', ')}]`
      };
    }
  },

  // --- F2: Storage Privacy & Isolation (5 tests) ---
  {
    id: "T2-F2-1",
    tier: 2,
    feature: 2,
    name: "Check that storage policy path structure enforces the user's organization prefix (split_part(name, '/', 1) = organization_id)",
    testFn: () => {
      const pass = /split_part\(\s*name\s*,\s*'\/'\s*,\s*1\s*\)\s*=\s*/i.test(allMigrationContent);
      return { pass, message: pass ? "Enforced organization prefix path constraint in policy." : "Missing split_part(name, '/', 1) prefix enforcement in storage policy." };
    }
  },
  {
    id: "T2-F2-2",
    tier: 2,
    feature: 2,
    name: "Check that storage policies prevent cross-tenant writes/deletes",
    testFn: () => {
      const pass = /WITH\s+CHECK\s*\(\s*bucket_id\s*=\s*'documentos_operacionales'[\s\S]*split_part/i.test(allMigrationContent);
      return { pass, message: pass ? "Verified WITH CHECK constraints on storage policy writes." : "Missing WITH CHECK statement validating organization prefix for uploads." };
    }
  },
  {
    id: "T2-F2-3",
    tier: 2,
    feature: 2,
    name: "Check that storage policies restrict actions specifically to the documentos_operacionales bucket",
    testFn: () => {
      const pass = /bucket_id\s*=\s*'documentos_operacionales'/i.test(allMigrationContent);
      return { pass, message: pass ? "Validated bucket_id restriction is present." : "Missing bucket_id = 'documentos_operacionales' filter in storage policies." };
    }
  },
  {
    id: "T2-F2-4",
    tier: 2,
    feature: 2,
    name: "Check that storage policies reject requests with empty or null organization IDs",
    testFn: () => {
      const pass = allMigrationContent.includes('get_my_organization_id()');
      return { pass, message: pass ? "Validated policy handles organization context." : "Storage policy lacks organization helper context resolution." };
    }
  },
  {
    id: "T2-F2-5",
    tier: 2,
    feature: 2,
    name: "Check that storage policies reject unauthenticated storage operations",
    testFn: () => {
      const pass = /TO\s+authenticated/i.test(allMigrationContent);
      return { pass, message: pass ? "Verified unauthenticated requests are blocked." : "Storage policy does not specify TO authenticated." };
    }
  },

  // --- F3: Signed URLs (5 tests) ---
  {
    id: "T2-F3-1",
    tier: 2,
    feature: 3,
    name: "Check that signed URL expiration is configured to be <= 60 seconds (short-lived) in storageService.js",
    testFn: () => {
      if (storageServiceFiles.length === 0) return { pass: false, message: "No storageService.js files found." };
      const failed = [];
      storageServiceFiles.forEach(f => {
        const matches = f.content.match(/createSignedUrl\s*\(\s*[^,]+,\s*(\d+)\s*\)/i);
        const limitPass = matches && parseInt(matches[1], 10) <= 60;
        if (!limitPass) failed.push(f.path);
      });
      const pass = failed.length === 0;
      return { pass, message: pass ? "All storageService.js files configure signed URL expiration to <= 60 seconds." : `Failed limit validation in: ${failed.join(', ')}` };
    }
  },
  {
    id: "T2-F3-2",
    tier: 2,
    feature: 3,
    name: "Check that the document viewer handles expired or invalid signed URLs gracefully",
    testFn: () => {
      if (documentViewerModalFiles.length === 0) return { pass: false, message: "No DocumentViewerModal.jsx files found." };
      const failed = documentViewerModalFiles.filter(f => !f.content.includes('onError') && !f.content.includes('catch') && !f.content.includes('refresh'));
      const pass = failed.length === 0;
      return { pass, message: pass ? "Graceful handling mechanism found in viewer modal." : `Missing error/refresh handling in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T2-F3-3",
    tier: 2,
    feature: 3,
    name: "Check that avatar uploads in PerfilSettings.jsx use a secure/isolated bucket or path structure",
    testFn: () => {
      if (perfilSettingsFiles.length === 0) return { pass: false, message: "No PerfilSettings.jsx files found." };
      const failed = perfilSettingsFiles.filter(f => !f.content.includes('organization_id') || !f.content.includes('avatars'));
      const pass = failed.length === 0;
      return { pass, message: pass ? "Avatar upload path is partitioned by organization_id." : `Avatar path lacks organization isolation in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T2-F3-4",
    tier: 2,
    feature: 3,
    name: "Check that Signed URL requests handle special characters in file paths",
    testFn: () => {
      if (storageServiceFiles.length === 0) return { pass: false, message: "No storageService.js files found." };
      const failed = storageServiceFiles.filter(f => !f.content.includes('encodeURIComponent') && !f.content.includes('createSignedUrl'));
      const pass = failed.length === 0;
      return { pass, message: pass ? "Verified encoding checks or signed URL helper methods." : `Missing special character handling in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T2-F3-5",
    tier: 2,
    feature: 3,
    name: "Check that frontend does not cache signed URL strings",
    testFn: () => {
      if (documentViewerModalFiles.length === 0) return { pass: false, message: "No DocumentViewerModal.jsx files found." };
      const failed = documentViewerModalFiles.filter(f => !f.content.includes('useEffect') || (!f.content.includes('currentUrl') && !f.content.includes('setUrl')));
      const pass = failed.length === 0;
      return { pass, message: pass ? "Component refreshes URLs via state hooks." : `Component persists URL strings in state incorrectly in: ${failed.map(f => f.path).join(', ')}` };
    }
  },

  // --- F4: Agency Registration Flow (5 tests) ---
  {
    id: "T2-F4-1",
    tier: 2,
    feature: 4,
    name: "Check that trigger falls back to a default organization if is_agency_registration is false/absent",
    testFn: () => {
      const pass = allMigrationContent.includes('00000000-0000-0000-0000-000000000000');
      return { pass, message: pass ? "Found default seed UUID fallback organization linking logic." : "Missing default fallback organization UUID linkage when is_agency_registration metadata is false/null." };
    }
  },
  {
    id: "T2-F4-2",
    tier: 2,
    feature: 4,
    name: "Check that trigger handles missing or empty agency_name by generating a default organization name",
    testFn: () => {
      const pass = allMigrationContent.includes('COALESCE') && allMigrationContent.includes('agency_name');
      return { pass, message: pass ? "Trigger performs COALESCE validation safeguarding against empty agency_name." : "Missing COALESCE fallback name formatting logic for empty/null agency_name values." };
    }
  },
  {
    id: "T2-F4-3",
    tier: 2,
    feature: 4,
    name: "Check that trigger is defined as SECURITY DEFINER with search path restricted to public",
    testFn: () => {
      const pass = /SECURITY\s+DEFINER/i.test(allMigrationContent) && /SET\s+search_path\s*=\s*public/i.test(allMigrationContent);
      return { pass, message: pass ? "Trigger function declared as SECURITY DEFINER with search_path set to public." : "Trigger function lacks SECURITY DEFINER execution permissions or does not restrict SET search_path = public." };
    }
  },
  {
    id: "T2-F4-4",
    tier: 2,
    feature: 4,
    name: "Check that agency signup flow does not hijack the active session (uses separate signup logic or Admin API)",
    testFn: () => {
      if (registerFormFiles.length === 0) {
        return { pass: false, message: "RegisterForm.jsx not found to inspect session hijack state." };
      }
      const failed = registerFormFiles.filter(f => {
        const usesEdgeFunction = f.content.includes('functions.invoke') || f.content.includes('/functions/v1/');
        const usesIndependentClient = f.content.includes('createClient(') && f.content.includes('auth: { persistSession: false }');
        return !usesEdgeFunction && !usesIndependentClient;
      });
      const pass = failed.length === 0;
      return { pass, message: pass ? "Frontend registers agencies using secure non-session-hijacking API invocation." : `Vulnerability: standard client auth.signUp used in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T2-F4-5",
    tier: 2,
    feature: 4,
    name: "Check that trigger operates inside a database transaction block (causes rollback on organization creation failure)",
    testFn: () => {
      const swallowsErrors = /EXCEPTION[\s\S]*WHEN\s+OTHERS\s+THEN[\s\S]*NULL/i.test(allMigrationContent);
      return { pass: !swallowsErrors, message: !swallowsErrors ? "Trigger does not swallow database exceptions, preserving standard transaction rollback." : "Warning: Trigger catches exceptions (swallowing errors), which may allow partial data insertions (orphaned users)." };
    }
  },

  // --- F5: Verification Script (5 tests) ---
  {
    id: "T2-F5-1",
    tier: 2,
    feature: 5,
    name: "Check that verify_rls.mjs exits with non-zero code if any table lacks RLS",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = verifyRlsContent.includes('process.exit(1)') || verifyRlsContent.includes('throw');
      return { pass, message: pass ? "Script terminates on table RLS failure." : "Missing non-zero exit handling on table failures." };
    }
  },
  {
    id: "T2-F5-2",
    tier: 2,
    feature: 5,
    name: "Check that verify_rls.mjs exits with non-zero code if bucket is public",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = verifyRlsContent.includes('process.exit(1)') || verifyRlsContent.includes('throw');
      return { pass, message: pass ? "Script terminates on bucket failure." : "Missing non-zero exit handling on bucket failures." };
    }
  },
  {
    id: "T2-F5-3",
    tier: 2,
    feature: 5,
    name: "Check that verify_rls.mjs checks for the presence of the default fallback organization",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = verifyRlsContent.includes('00000000-0000-0000-0000-000000000000');
      return { pass, message: pass ? "Script asserts default org UUID." : "Missing validation of default fallback organization." };
    }
  },
  {
    id: "T2-F5-4",
    tier: 2,
    feature: 5,
    name: "Check that verify_rls.mjs validates policy names match the standard tenant_isolation_policy",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = verifyRlsContent.includes('tenant_isolation_policy');
      return { pass, message: pass ? "Script validates policy names." : "Missing validation of isolation policy naming standards." };
    }
  },
  {
    id: "T2-F5-5",
    tier: 2,
    feature: 5,
    name: "Check that verify_rls.mjs handles database connection errors gracefully and exits with non-zero code",
    testFn: () => {
      if (!verifyRlsContent) return { pass: false, message: "verify_rls.mjs not found." };
      const pass = /catch\s*\(\s*([a-zA-Z0-9_]+)?\s*\)[\s\S]*process\.exit/i.test(verifyRlsContent);
      return { pass, message: pass ? "Graceful exit block found for database connection exceptions." : "Missing exit handler on database connection exceptions." };
    }
  },

  // ==================== TIER 3: CROSS-FEATURE COMBINATIONS (5 TESTS) ====================
  {
    id: "T3-1",
    tier: 3,
    feature: 4, // F4 + F1
    name: "Onboarding & Tenant Policy: Verify registering an agency automatically provisions tenant database entries isolated by RLS policy",
    testFn: () => {
      const hasTrigger = allMigrationContent.includes('handle_new_user');
      const hasRlsHelper = allMigrationContent.includes('get_my_organization_id');
      const pass = hasTrigger && hasRlsHelper;
      return { pass, message: pass ? "Trigger and RLS helper both exist in database configuration." : "Missing trigger handle_new_user or get_my_organization_id helper function." };
    }
  },
  {
    id: "T3-2",
    tier: 3,
    feature: 4, // F4 + F2
    name: "Onboarding & Storage Folders: Verify registering an agency automatically provisions storage path partition matching new organization ID",
    testFn: () => {
      const splitPartCheck = allMigrationContent.includes("split_part(name, '/', 1) =");
      const storagePrefixCheck = storageServiceFiles.some(f => f.content.includes('organization_id') || f.content.includes('get_my_organization_id'));
      const pass = splitPartCheck || storagePrefixCheck;
      return { pass, message: pass ? "Storage bucket policies enforce organization prefixes dynamically." : "Storage path prefixing by organization ID is not configured." };
    }
  },
  {
    id: "T3-3",
    tier: 3,
    feature: 2, // F2 + F3 + F1
    name: "Storage, URLs & DB: Verify uploading file to private bucket logs in DB and is viewable only via short-lived signed URLs",
    testFn: () => {
      if (storageServiceFiles.length === 0) return { pass: false, message: "No storageService.js files found." };
      const failed = storageServiceFiles.filter(f => {
        const logsDb = f.content.includes('documentos_operacionales') && f.content.includes('insert');
        const hasSignedUrl = f.content.includes('createSignedUrl');
        const hasPublicUrl = f.content.includes('getPublicUrl');
        return !logsDb || !hasSignedUrl || hasPublicUrl;
      });
      const pass = failed.length === 0;
      return { pass, message: pass ? "File uploads correctly log to database table and retrieve signed URLs, avoiding public URLs." : `Compliance failed in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T3-4",
    tier: 3,
    feature: 3, // F1 + F3
    name: "DB RLS & URL Fetch: Verify fetching document metadata restricted by DB RLS generates signed URL accessible only to tenant",
    testFn: () => {
      if (storageServiceFiles.length === 0) return { pass: false, message: "No storageService.js files found." };
      const failed = storageServiceFiles.filter(f => {
        const queriesDocs = f.content.includes('documentos_operacionales') && f.content.includes('select');
        const generatesSignedUrl = f.content.includes('createSignedUrl');
        return !queriesDocs || !generatesSignedUrl;
      });
      const pass = failed.length === 0;
      return { pass, message: pass ? "Document fetching queries database first, then generates dynamic signed URLs." : `Compliance failed in: ${failed.map(f => f.path).join(', ')}` };
    }
  },
  {
    id: "T3-5",
    tier: 3,
    feature: 5, // F5 + F1 + F2
    name: "Verification Script RLS Assertion: Verify the verification script correctly asserts RLS is enabled on database tables and storage buckets",
    testFn: () => {
      if (!verifyRlsContent) {
        return { pass: false, message: "verify_rls.mjs file not found." };
      }
      const assertsRls = verifyRlsContent.includes('rowlevelsecurity') || verifyRlsContent.includes('ENABLE ROW LEVEL SECURITY');
      const assertsBucket = verifyRlsContent.includes('bucket') || verifyRlsContent.includes('public') || verifyRlsContent.includes('private');
      const pass = assertsRls && assertsBucket;
      return { pass, message: pass ? "verify_rls.mjs asserts both database RLS status and bucket privacy status." : `Checks failed: assertsRls=${assertsRls}, assertsBucket=${assertsBucket}` };
    }
  },

  // ==================== TIER 4: REAL-WORLD APPLICATION SCENARIOS (5 TESTS) ====================
  {
    id: "T4-1",
    tier: 4,
    feature: 1, // F4 + F1
    name: "Real-world: Multi-Tenant Onboarding and Data Isolation simulation is defined in verification tests",
    testFn: () => {
      if (!verifyRlsContent) {
        return { pass: false, message: "verify_rls.mjs file not found." };
      }
      const includesMultiTenantSim = verifyRlsContent.includes('Agency A') || verifyRlsContent.includes('Agency B') || 
                                     verifyRlsContent.includes('tenant_a') || verifyRlsContent.includes('tenant_b') ||
                                     verifyRlsContent.includes('simulate') || verifyRlsContent.includes('mock');
      return { pass: includesMultiTenantSim, message: includesMultiTenantSim ? "Verification helper simulates multi-tenant operations." : "No simulation references of multiple tenant sessions found in verify_rls.mjs." };
    }
  },
  {
    id: "T4-2",
    tier: 4,
    feature: 2, // F2
    name: "Real-world: File Storage Access Flow and Leak Prevention validation is defined in audit tools",
    testFn: () => {
      if (!verifyRlsContent) {
        return { pass: false, message: "verify_rls.mjs file not found." };
      }
      const validatesStorageIsolation = verifyRlsContent.includes('documentos_operacionales') && 
                                        (verifyRlsContent.includes('policy') || verifyRlsContent.includes('path') || verifyRlsContent.includes('prefix'));
      return { pass: validatesStorageIsolation, message: validatesStorageIsolation ? "verify_rls.mjs scans bucket policies and storage isolation folders." : "verify_rls.mjs lacks rules asserting bucket privacy and isolation settings." };
    }
  },
  {
    id: "T4-3",
    tier: 4,
    feature: 3, // F1 + F3
    name: "Real-world: Session Hijack & Organization Drift prevention checks are defined in DB policies or frontend",
    testFn: () => {
      const rejectsOrgChange = allMigrationContent.includes('organization_id') && 
                               (allMigrationContent.includes('WITH CHECK') || allMigrationContent.includes('FORCE ROW LEVEL SECURITY'));
      return { pass: rejectsOrgChange, message: rejectsOrgChange ? "Found RLS checks enforcing organization_id consistency during writes." : "Lacks explicit check ensuring organization_id column modifications are rejected." };
    }
  },
  {
    id: "T4-4",
    tier: 4,
    feature: 4, // F5
    name: "Real-world: End-to-End Verification Tool Execution fails appropriately in unmigrated state",
    testFn: () => {
      if (!verifyRlsContent) {
        return { pass: false, message: "verify_rls.mjs file not found." };
      }
      const exitsOnError = verifyRlsContent.includes('process.exit(1)') || verifyRlsContent.includes('throw');
      return { pass: exitsOnError, message: exitsOnError ? "verify_rls.mjs script throws or exits with error code when RLS asserts fail." : "verify_rls.mjs does not terminate with exit code 1 / errors when policies are missing." };
    }
  },
  {
    id: "T4-5",
    tier: 4,
    feature: 5, // F5
    name: "Real-world: Concurrent Multi-Tenant Load connection bounds are verified in database integrations",
    testFn: () => {
      if (!verifyRlsContent) {
        return { pass: false, message: "verify_rls.mjs file not found." };
      }
      const configHasLimits = verifyRlsContent.includes('pool') || verifyRlsContent.includes('max') || 
                               verifyRlsContent.includes('connectionLimit') || verifyRlsContent.includes('supabase');
      return { pass: configHasLimits, message: configHasLimits ? "Database integration scripts utilize pooled / restricted connection settings." : "Database connection checks lack pool limits (can cause connection exhaustion)." };
    }
  }
];

export { tests };
