-- Paste this into the Supabase SQL Editor to create the necessary tables for the Community feature

-- 1. Create Profiles Table (if it doesn't already exist)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  username text,
  avatar_url text,
  is_admin boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Create Community Messages Table
CREATE TABLE IF NOT EXISTS public.community_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  channel text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  image_url text,
  reply_to uuid REFERENCES public.community_messages(id) ON DELETE SET NULL,
  tags text[] DEFAULT '{}'::text[],
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for messages
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Messages are viewable by everyone." ON public.community_messages FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert messages." ON public.community_messages FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own messages." ON public.community_messages FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own messages or admins can delete any." ON public.community_messages FOR DELETE USING (auth.uid() = user_id OR (SELECT is_admin FROM public.profiles WHERE id = auth.uid()) = true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Set up Realtime for community_messages
-- Check if realtime publication exists, if not create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END
$$;

-- Add table to publication if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'community_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;
  END IF;
END
$$;

-- 4. Create community_images storage bucket (if not using Dashboard)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('community_images', 'community_images', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
CREATE POLICY "Public Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'community_images' );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
CREATE POLICY "Auth Users Upload"
  ON storage.objects FOR INSERT
  WITH CHECK ( bucket_id = 'community_images' AND auth.role() = 'authenticated' );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Polls tables (for Community Polls tab)
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id uuid REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
  option_text text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.poll_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  option_id uuid REFERENCES public.poll_options(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(option_id, user_id)
);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Polls are viewable by everyone." ON public.polls FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can create polls." ON public.polls FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Poll options are viewable by everyone." ON public.poll_options FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert poll options (via app)." ON public.poll_options FOR INSERT WITH CHECK (auth.role() = 'authenticated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Poll votes are viewable by everyone." ON public.poll_votes FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Authenticated users can vote." ON public.poll_votes FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can delete their own votes." ON public.poll_votes FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
