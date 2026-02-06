const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_AVATAR_URL_LENGTH = 2048;

export function validateEmail(email) {
  return EMAIL_REGEX.test(email ?? "");
}

export function validatePassword(password) {
  return typeof password === "string" && password.length >= MIN_PASSWORD_LENGTH;
}

export function validateUserCreate(payload = {}) {
  const errors = {};
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password =
    typeof payload.password === "string" ? payload.password.trim() : "";

  if (!name) {
    errors.name = "Name is required";
  }

  if (!email || !validateEmail(email)) {
    errors.email = "Valid email is required";
  }

  if (!password || !validatePassword(password)) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }

  return {
    data: {
      name,
      email: email.toLowerCase(),
      password,
    },
    errors,
  };
}

export function validateUserUpdate(payload = {}) {
  const errors = {};
  const data = {};

  if (payload.name !== undefined) {
    const name = typeof payload.name === "string" ? payload.name.trim() : "";
    if (!name) {
      errors.name = "Name cannot be empty";
    } else {
      data.name = name;
    }
  }

  if (payload.email !== undefined) {
    const email =
      typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || !validateEmail(email)) {
      errors.email = "Valid email is required";
    } else {
      data.email = email;
    }
  }

  if (payload.password !== undefined) {
    const password =
      typeof payload.password === "string" ? payload.password.trim() : "";
    if (!password || !validatePassword(password)) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    } else {
      data.password = password;
    }
  }

  if (payload.avatar !== undefined || payload.avatarUrl !== undefined) {
    const avatarRaw = payload.avatarUrl ?? payload.avatar;
    const avatar = typeof avatarRaw === "string" ? avatarRaw.trim() : "";
    if (!avatar) {
      data.avatar = null;
    } else if (!/^https?:\/\//i.test(avatar)) {
      errors.avatar = "Avatar must be a valid URL.";
    } else if (avatar.length > MAX_AVATAR_URL_LENGTH) {
      errors.avatar = "Avatar URL is too long.";
    } else {
      data.avatar = avatar;
    }
  }

  if (payload.timezone !== undefined) {
    const timezone = typeof payload.timezone === "string" ? payload.timezone.trim() : "";
    if (!timezone) {
      errors.timezone = "Timezone cannot be empty";
    } else {
      data.timezone = timezone;
    }
  }

  return { data, errors };
}

export function hasValidationErrors(errors) {
  return Object.keys(errors).length > 0;
}

