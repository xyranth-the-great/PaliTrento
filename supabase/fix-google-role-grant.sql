-- Fix: Allow the Google account role RPC to update the 'role' column
-- The column grant in schema.sql only permits full_name and barangay updates.
-- The SECURITY DEFINER RPC needs to update 'role' during Google signup.

grant update (full_name, barangay, role) on profiles to authenticated;