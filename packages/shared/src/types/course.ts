export interface Course {
  id: string;
  code: string;
  title: string;
  term: string;
  professor_id: string;
  created_at: string;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  role: 'student' | 'ta';
  enrolled_at: string;
}

export interface CreateCourseInput {
  code: string;
  title: string;
  term: string;
}
