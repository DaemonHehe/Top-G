export function sanitizeLift(lift) {
  if (!lift) return null;

  return {
    id: lift._id?.toString(),
    _id: lift._id?.toString(),
    exerciseId: lift.exerciseId ?? null,
    exercise: lift.exercise,
    weight: lift.weight,
    reps: lift.reps,
    notes: lift.notes,
    date: lift.date,
    recordedAt: lift.recordedAt instanceof Date ? lift.recordedAt.toISOString() : lift.recordedAt,
    createdAt: lift.createdAt instanceof Date ? lift.createdAt.toISOString() : lift.createdAt,
    updatedAt: lift.updatedAt instanceof Date ? lift.updatedAt.toISOString() : lift.updatedAt,
  };
}
