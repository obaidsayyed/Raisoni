// Supabase Edge Function: admin-create-faculty
// Provision new faculty accounts securely with Supabase Auth Admin API
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 1. Verify that the caller is an active administrator
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, status")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "active") {
      return new Response(
        JSON.stringify({ error: "Forbidden: Administrator role required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { full_name, username, temp_password } = await req.json();

    if (!full_name || !username || !temp_password) {
      return new Response(
        JSON.stringify({ error: "Full name, username, and temporary password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanUsername = username.trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 32 || !/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      return new Response(
        JSON.stringify({ error: "Username must be 3-32 characters and alphanumeric (with hyphens/underscores)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check username uniqueness
    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", cleanUsername)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: "Username is already taken" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create Auth User
    const internalEmail = `${cleanUsername.toLowerCase()}@allocator.internal`;
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password: temp_password,
      email_confirm: true,
      user_metadata: {
        username: cleanUsername,
        full_name,
      },
    });

    if (createError || !newUser.user) {
      return new Response(
        JSON.stringify({ error: `Auth creation failed: ${createError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newUserId = newUser.user.id;

    // 4. Create Profile (with must_change_password = true)
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: newUserId,
      username: cleanUsername,
      full_name,
      role: "faculty",
      status: "active",
      must_change_password: true,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return new Response(
        JSON.stringify({ error: `Failed to insert profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Create Username Lookup
    await supabaseAdmin.from("auth_username_lookup").insert({
      username: cleanUsername,
      user_id: newUserId,
      email: internalEmail,
    });

    // 6. Audit Log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: callerUser.id,
      action: "PROVISION_FACULTY",
      entity_type: "profile",
      entity_id: newUserId,
      details: {
        username: cleanUsername,
        full_name,
        created_by: callerUser.id,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Faculty account provisioned successfully. They must change password upon first login.",
        faculty: {
          id: newUserId,
          username: cleanUsername,
          full_name,
          role: "faculty",
          status: "active",
        },
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
