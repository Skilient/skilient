/** One coach mark: the element it points at (a `data-tour` id), a title and a sentence or two. */
export interface TourStep {
  anchor: string;
  title: string;
  body: string;
  /** The page this step is on: the tour goes there first. Without one, the step shows on whatever page the tour is on. */
  path?: string;
  /** A media query that must match for the step to exist at all (the sidebar's second tier, say, is desktop only). */
  media?: string;
  /** One thing to do next, on the last step: ends the tour as completed, then focuses the field inside this `data-tour` element. */
  cta?: { label: string; focus: string };
}

export interface TourDefinition {
  id: "student" | "faculty" | "recruiter" | "uni_admin";
  /** Where the tour starts by itself the first time a verified user lands there. */
  startPath: string;
  steps: TourStep[];
}
