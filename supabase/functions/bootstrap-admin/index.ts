// Supabase Edge Function: bootstrap-admin
// Secure one-time initialization of the built-in administrator account
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Server misconfiguration: Service role key missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // 1. Verify if an administrator already exists
    const { data: existingAdmin, error: checkError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (checkError) {
      return new Response(
        JSON.stringify({ error: `Database error checking admin: ${checkError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (existingAdmin && existingAdmin.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Bootstrap procedure disabled: An administrator account already exists.",
          already_bootstrapped: true,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Exact Bootstrap Credentials
    const bootstrapUsername = "Admin123";
    const bootstrapPassword = "Admin@123";
    const bootstrapEmail = "admin123@allocator.internal";

    // 3. Create Auth User
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: bootstrapEmail,
      password: bootstrapPassword,
      email_confirm: true,
      user_metadata: {
        username: bootstrapUsername,
        full_name: "System Administrator",
      },
    });

    if (authError || !authUser.user) {
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authUser.user.id;

    // 4. Insert Profile with must_change_password = true
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      username: bootstrapUsername,
      full_name: "System Administrator",
      role: "admin",
      status: "active",
      must_change_password: true,
    });

    if (profileError) {
      // Cleanup auth user on failure
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Failed to create profile: ${profileError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Insert Username Lookup
    await supabaseAdmin.from("auth_username_lookup").insert({
      username: bootstrapUsername,
      user_id: userId,
      email: bootstrapEmail,
    });

    // 6. Log audit
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "BOOTSTRAP_ADMIN",
      entity_type: "profile",
      entity_id: userId,
      details: { message: "Initial bootstrap administrator provisioned successfully." },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Initial administrator provisioned. You must change the default password upon initial login.",
        username: bootstrapUsername,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
