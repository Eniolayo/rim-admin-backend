/**
 * Formats a role name for display in the UI.
 * Converts role names like "super_admin" or "super_Admin" to "Super Admin"
 *
 * @param roleName - The role name to format (e.g., "super_admin", "super_Admin", "admin")
 * @returns Formatted role name (e.g., "Super Admin", "Admin")
 */
export function formatRoleName(roleName: string | null | undefined): string {
  if (!roleName) {
    return '';
  }

  // Handle special case for super_admin variations
  const normalized = roleName.toLowerCase();
  if (normalized === 'super_admin') {
    return 'Super Admin';
  }

  // Split by underscore and capitalize each word
  const parts = roleName.split('_');
  return parts
    .map((part) => {
      if (!part) return '';
      // Capitalize first letter, rest lowercase
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Formats a role name for display in the UI, returning null for empty values.
 * Useful for optional role name fields.
 *
 * @param roleName - The role name to format (e.g., "super_admin", "super_Admin", "admin")
 * @returns Formatted role name (e.g., "Super Admin", "Admin") or null if empty
 */
export function formatRoleNameNullable(
  roleName: string | null | undefined,
): string | null {
  if (!roleName) {
    return null;
  }
  return formatRoleName(roleName);
}
