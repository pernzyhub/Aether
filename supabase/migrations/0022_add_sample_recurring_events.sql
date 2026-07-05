-- Add sample events for testing recurring events and upcoming event display
-- These will help verify the portal.js upcoming event logic

-- Sample recurring events (weekly)
INSERT INTO public.events (name, description, points, is_active, is_recurring, recurrence_type, recurrence_days, recurrence_time, event_type_id)
VALUES
  (
    'Weekly Guild Meeting',
    'Mandatory weekly gathering for guild announcements and coordination',
    10,
    true,
    true,
    'weekly',
    '[3]', -- Wednesday (0=Sunday, 3=Wednesday)
    '19:00:00',
    (SELECT id FROM public.event_types WHERE name = 'Guild Meeting' LIMIT 1)
  ),
  (
    'Weekend Raid',
    'Saturday night raid event - bring your best gear!',
    25,
    true,
    true,
    'weekly',
    '[5, 6]', -- Friday and Saturday (5=Friday, 6=Saturday)
    '20:00:00',
    (SELECT id FROM public.event_types WHERE name = 'Raid' LIMIT 1)
  ),
  (
    'Activity Night',
    'Various guild activities - games, competitions, and fun',
    15,
    true,
    true,
    'weekly',
    '[0]', -- Sunday
    '18:00:00',
    (SELECT id FROM public.event_types WHERE name = 'Activity' LIMIT 1)
  ),
  (
    'Quest Expedition',
    'Group quest time - work together to complete objectives',
    20,
    true,
    true,
    'biweekly',
    '[2]', -- Tuesday (2=Tuesday)
    '19:30:00',
    (SELECT id FROM public.event_types WHERE name = 'Quest' LIMIT 1)
  )
ON CONFLICT DO NOTHING;
