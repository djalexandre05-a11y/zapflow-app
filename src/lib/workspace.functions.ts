import { createServerFn } from "@tanstack/react-start";

type GetWorkspacesInput = { userId: string; email: string };
export const getWorkspaces = createServerFn({ method: "POST" })
  .inputValidator((d: GetWorkspacesInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _admin as any;
    
    // Workspaces I own
    const { data: owned } = await supabaseAdmin
      .from("workspaces")
      .select("*")
      .eq("owner_id", data.userId);

    // Workspaces I am a member of
    const { data: memberOfRows } = await supabaseAdmin
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_email", data.email);

    let memberOf: any[] = [];
    if (memberOfRows && memberOfRows.length > 0) {
      const ids = memberOfRows.map((r: any) => r.workspace_id);
      const { data: wSpaces } = await supabaseAdmin
        .from("workspaces")
        .select("*")
        .in("id", ids);
      memberOf = wSpaces || [];
    }

    const all = [...(owned || []), ...memberOf];
    // deduplicate by id
    const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
    
    return unique;
  });

type CreateInput = { userId: string; name: string };
export const createWorkspace = createServerFn({ method: "POST" })
  .inputValidator((d: CreateInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _admin as any;
    const { data: ws, error } = await supabaseAdmin
      .from("workspaces")
      .insert({ name: data.name, owner_id: data.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return ws;
  });

type MemberInput = { workspaceId: string; email: string };
export const addMember = createServerFn({ method: "POST" })
  .inputValidator((d: MemberInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _admin as any;
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .insert({ workspace_id: data.workspaceId, user_email: data.email });
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .inputValidator((d: MemberInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _admin as any;
    const { error } = await supabaseAdmin
      .from("workspace_members")
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("user_email", data.email);
    if (error) throw new Error(error.message);
    return { success: true };
  });

type GetMembersInput = { workspaceId: string };
export const getWorkspaceMembers = createServerFn({ method: "POST" })
  .inputValidator((d: GetMembersInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _admin as any;
    const { data: rows, error } = await supabaseAdmin
      .from("workspace_members")
      .select("*")
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);
    return rows;
  });

type SaveConnInput = { workspaceId: string; provider: string; name: string; accessToken?: string; phoneNumberId?: string; wabaId?: string; apiKey?: string };
export const saveConnection = createServerFn({ method: "POST" })
  .inputValidator((d: SaveConnInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server"); const supabaseAdmin = _admin as any;
    const { data: conn, error } = await supabaseAdmin
      .from("workspace_connections")
      .insert({
        workspace_id: data.workspaceId,
        provider: data.provider,
        name: data.name,
        access_token: data.accessToken,
        phone_number_id: data.phoneNumberId,
        waba_id: data.wabaId,
        api_key: data.apiKey,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return conn;
  });

type GetConnInput = { workspaceId: string };
export const getConnections = createServerFn({ method: "POST" })
  .inputValidator((d: GetConnInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server");
    const supabaseAdmin = _admin as any;
    const { data: rows, error } = await supabaseAdmin
      .from("workspace_connections")
      .select("*")
      .eq("workspace_id", data.workspaceId)
      .eq("active", true);
    if (error) throw new Error(error.message);
    return rows;
  });

type TransferInput = { phone: string; assignToEmail: string | null };
export const transferContact = createServerFn({ method: "POST" })
  .inputValidator((d: TransferInput) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin: _admin } = await import("@/integrations/supabase/client.server"); 
    const supabaseAdmin = _admin as any;
    const { error } = await supabaseAdmin
      .from("user_contacts")
      .update({ assigned_to: data.assignToEmail })
      .eq("phone", data.phone);
    if (error) throw new Error(error.message);
    return { success: true };
  });

