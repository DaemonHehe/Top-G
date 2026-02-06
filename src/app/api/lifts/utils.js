export function sanitizeLift(lift) {
  if (!lift) return null;

  const id = lift.id ?? lift._id?.toString();
  const recordedAt = lift.recorded_at ?? lift.recordedAt;
  const createdAt = lift.created_at ?? lift.createdAt;
  const updatedAt = lift.updated_at ?? lift.updatedAt;

  return {
    id,
    _id: id,
    exerciseId: lift.exercise_id ?? lift.exerciseId ?? null,
    exercise: lift.exercise,
    weight: lift.weight,
    reps: lift.reps,
    notes: lift.notes,
    date: lift.date,
    recordedAt: recordedAt instanceof Date ? recordedAt.toISOString() : recordedAt,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
  };
}
