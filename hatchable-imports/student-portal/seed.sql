INSERT INTO courses (title, description, level)
SELECT 'Web Development', 'Learn to build responsive websites and web applications.', 'Beginner'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title = 'Web Development');

INSERT INTO courses (title, description, level)
SELECT 'Cybersecurity Fundamentals', 'Learn security basics, safe practices, and digital protection.', 'Beginner'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title = 'Cybersecurity Fundamentals');

INSERT INTO courses (title, description, level)
SELECT 'Python Programming', 'Build programming foundations with practical Python projects.', 'Beginner'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title = 'Python Programming');

INSERT INTO courses (title, description, level)
SELECT 'Computer Fundamentals', 'Develop essential computer and digital literacy skills.', 'Beginner'
WHERE NOT EXISTS (SELECT 1 FROM courses WHERE title = 'Computer Fundamentals');