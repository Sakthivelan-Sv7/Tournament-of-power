CREATE TABLE polls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  question text NOT NULL,
  options jsonb NOT NULL,
  created_by uuid REFERENCES profiles(id),
  created_at timestamp with time zone DEFAULT now()
);
CREATE TABLE poll_votes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id uuid REFERENCES polls(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  option text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);
