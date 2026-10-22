-- Idempotent role and permission catalog. No Auth users or team profiles are seeded.
insert into public.roles (code, name, description) values
  ('platform_owner', 'Platform Owner', 'Governance of team access, content, operations, audit, and application configuration.'),
  ('technical_lead', 'Technical Lead', 'Approved technical operations and technical audit visibility.'),
  ('operations_lead', 'Operations Lead', 'Client inquiries, registrations, and waitlist operations.'),
  ('content_community_lead', 'Content & Community Lead', 'Service, portfolio, product, event, and announcement content.')
on conflict (code) do update
set name = excluded.name, description = excluded.description;

insert into public.permissions (code, description) values
  ('team.read', 'Read team profiles and role assignments.'),
  ('team.manage', 'Manage team profiles through an approved server workflow.'),
  ('roles.assign', 'Assign roles through an approved server workflow.'),
  ('settings.manage', 'Manage application configuration.'),
  ('content.read', 'Read content management records.'),
  ('content.create', 'Create content drafts.'),
  ('content.update', 'Edit content drafts.'),
  ('content.publish', 'Publish approved content.'),
  ('inquiries.read', 'Read private client inquiries and contact submissions.'),
  ('inquiries.manage', 'Manage private client inquiries and contact submissions.'),
  ('registrations.read', 'Read event registrations.'),
  ('registrations.manage', 'Manage event registrations.'),
  ('waitlists.read', 'Read product waitlists.'),
  ('waitlists.manage', 'Manage product waitlists.'),
  ('audit.read', 'Read all administrative audit records.'),
  ('audit.technical.read', 'Read technical audit records only.'),
  ('technical.read', 'View technical configuration.'),
  ('technical.manage', 'Perform approved technical operations.')
on conflict (code) do update
set description = excluded.description;

with grants (role_code, permission_code) as (
  values
    ('platform_owner', 'team.read'),
    ('platform_owner', 'team.manage'),
    ('platform_owner', 'roles.assign'),
    ('platform_owner', 'settings.manage'),
    ('platform_owner', 'content.read'),
    ('platform_owner', 'content.create'),
    ('platform_owner', 'content.update'),
    ('platform_owner', 'content.publish'),
    ('platform_owner', 'inquiries.read'),
    ('platform_owner', 'inquiries.manage'),
    ('platform_owner', 'registrations.read'),
    ('platform_owner', 'registrations.manage'),
    ('platform_owner', 'waitlists.read'),
    ('platform_owner', 'waitlists.manage'),
    ('platform_owner', 'audit.read'),
    ('platform_owner', 'audit.technical.read'),
    ('platform_owner', 'technical.read'),
    ('platform_owner', 'technical.manage'),
    ('technical_lead', 'technical.read'),
    ('technical_lead', 'technical.manage'),
    ('technical_lead', 'audit.technical.read'),
    ('operations_lead', 'inquiries.read'),
    ('operations_lead', 'inquiries.manage'),
    ('operations_lead', 'registrations.read'),
    ('operations_lead', 'registrations.manage'),
    ('operations_lead', 'waitlists.read'),
    ('operations_lead', 'waitlists.manage'),
    ('content_community_lead', 'content.read'),
    ('content_community_lead', 'content.create'),
    ('content_community_lead', 'content.update'),
    ('content_community_lead', 'content.publish')
)
insert into public.role_permissions (role_id, permission_id)
select role.id, permission.id
from grants
join public.roles as role on role.code = grants.role_code
join public.permissions as permission on permission.code = grants.permission_code
on conflict (role_id, permission_id) do nothing;
