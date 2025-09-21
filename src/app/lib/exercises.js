export const EXERCISE_GROUPS = [
  {
    id: "chest_push",
    label: "Chest / Push",
    exercises: [
      {
        id: "bench_press_barbell",
        label: "Bench Press (Barbell)",
        shortLabel: "Bench Press",
        aliases: ["bench press", "barbell bench press", "flat bench"],
      },
      {
        id: "bench_press_dumbbell",
        label: "Bench Press (Dumbbell)",
        aliases: ["dumbbell bench press"],
      },
      {
        id: "incline_press_barbell",
        label: "Incline Press (Barbell)",
        aliases: ["incline bench press", "incline press"],
      },
      {
        id: "incline_press_dumbbell",
        label: "Incline Press (Dumbbell)",
        aliases: ["dumbbell incline press"],
      },
      {
        id: "overhead_press",
        label: "Overhead Press",
        shortLabel: "Overhead Press",
        aliases: ["military press", "shoulder press", "strict press"],
      },
    ],
  },
  {
    id: "lower_body",
    label: "Lower Body",
    exercises: [
      {
        id: "squat_back",
        label: "Squat",
        shortLabel: "Squat",
        aliases: ["back squat", "barbell squat"],
      },
      {
        id: "deadlift",
        label: "Deadlift",
        shortLabel: "Deadlift",
        aliases: ["conventional deadlift"],
      },
      {
        id: "romanian_deadlift",
        label: "Romanian Deadlift",
        aliases: ["rdl"],
      },
      {
        id: "hip_thrust",
        label: "Hip Thrust",
        aliases: ["barbell hip thrust"],
      },
      {
        id: "leg_press",
        label: "Leg Press",
        aliases: ["machine leg press"],
      },
      {
        id: "bulgarian_split_squat",
        label: "Bulgarian Split Squat",
        aliases: ["split squat"],
      },
    ],
  },
  {
    id: "back_pull",
    label: "Back / Pull",
    exercises: [
      {
        id: "lat_pulldown",
        label: "Lat Pulldown",
        aliases: ["lat pull-down", "pulldown"],
      },
      {
        id: "barbell_row",
        label: "Barbell Row",
        aliases: ["bent over row", "barbell bent over row"],
      },
      {
        id: "dumbbell_row",
        label: "Dumbbell Row",
        aliases: ["one arm row", "single arm row"],
      },
      {
        id: "face_pull",
        label: "Face Pull",
        aliases: ["rope face pull"],
      },
    ],
  },
  {
    id: "arms_shoulders",
    label: "Arms & Shoulders (Isolation)",
    exercises: [
      {
        id: "lateral_raise",
        label: "Lateral Raise",
        aliases: ["side raise", "dumbbell lateral raise"],
      },
      {
        id: "biceps_curl",
        label: "Biceps Curl",
        aliases: ["curl", "barbell curl", "dumbbell curl"],
      },
      {
        id: "triceps_pushdown",
        label: "Triceps Pushdown",
        aliases: ["tricep pushdown", "rope pushdown"],
      },
    ],
  },
];

const EXERCISE_MAP = new Map();
const LABEL_MAP = new Map();

EXERCISE_GROUPS.forEach((group) => {
  group.exercises.forEach((exercise) => {
    EXERCISE_MAP.set(exercise.id, exercise);
    const aliases = [exercise.label, exercise.id, ...(exercise.aliases ?? [])];
    aliases.forEach((alias) => {
      LABEL_MAP.set(alias.toLowerCase(), exercise.id);
    });
  });
});

export const BIG_FOUR_EXERCISES = [
  { id: "squat_back", label: "Squat", shortLabel: "Squat" },
  { id: "deadlift", label: "Deadlift", shortLabel: "Deadlift" },
  { id: "bench_press_barbell", label: "Bench Press (Barbell)", shortLabel: "Bench Press" },
  { id: "overhead_press", label: "Overhead Press", shortLabel: "Overhead Press" },
];

export const BIG_FOUR_IDS = BIG_FOUR_EXERCISES.map((exercise) => exercise.id);

export const getExerciseById = (id) => {
  if (!id) return null;
  return EXERCISE_MAP.get(id) ?? null;
};

export const findExerciseIdByLabel = (label) => {
  if (!label) return null;
  const normalized = label.trim().toLowerCase();
  return LABEL_MAP.get(normalized) ?? null;
};

export const resolveExerciseLabel = (id, fallback = "") => {
  const exercise = getExerciseById(id);
  return exercise?.label ?? fallback ?? "";
};
