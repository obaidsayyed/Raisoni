// Supabase Edge Function: admin-reset-password
// Reset a faculty member's password and enforce password change on next login
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

    const { user_id, temp_password } = await req.json();

    if (!user_id || !temp_password) {
      return new Response(
        JSON.stringify({ error: "User ID and new temporary password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Update password in Supabase Auth via Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: temp_password,
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Password update failed: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Set must_change_password = true in profile
    await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq("id", user_id);

    // 3. Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: callerUser.id,
      action: "RESET_FACULTY_PASSWORD",
      entity_type: "profile",
      entity_id: user_id,
      details: { reset_by: callerUser.id },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Temporary password set successfully. Faculty will be required to change it on next login.",
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
