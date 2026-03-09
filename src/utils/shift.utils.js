const TIME_ZONE = "Asia/Tashkent";

const getDatePartsInTimeZone = (value, timeZone = TIME_ZONE) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value ?? 0);
  const month = Number(parts.find((p) => p.type === "month")?.value ?? 0);
  const day = Number(parts.find((p) => p.type === "day")?.value ?? 0);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);

  if (!year || !month || !day) return null;

  return {
    dateStr: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    year,
    month,
    day,
    hour,
    minute,
    minutes: hour * 60 + minute,
  };
};

const getDateStringInTimeZone = (value, timeZone = TIME_ZONE) =>
  getDatePartsInTimeZone(value, timeZone)?.dateStr ?? null;

const getMinutesInTimeZone = (value, timeZone = TIME_ZONE) =>
  getDatePartsInTimeZone(value, timeZone)?.minutes ?? null;

const toMinutesFromHHMM = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string" || !timeStr.includes(":")) return 0;
  const [h, m] = timeStr.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
};

const shiftCrossesMidnight = (department) => {
  if (!department) return false;
  const checkIn = toMinutesFromHHMM(department.checkInTime);
  const checkOut = toMinutesFromHHMM(department.checkOutTime);
  return checkOut <= checkIn;
};

const shiftDurationMinutes = (department) => {
  if (!department) return 0;
  const checkIn = toMinutesFromHHMM(department.checkInTime);
  const checkOut = toMinutesFromHHMM(department.checkOutTime);
  let diff = checkOut - checkIn;
  if (diff <= 0) diff += 24 * 60;
  return diff;
};

const shiftEndThresholdMinutes = (department) => {
  if (!department) return 0;
  return toMinutesFromHHMM(department.checkOutTime);
};

const previousDateString = (dateStr) => {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const resolveAttendanceDate = (department, direction, eventTime) => {
  const parts = getDatePartsInTimeZone(eventTime);
  if (!parts) return null;

  if (!shiftCrossesMidnight(department)) {
    return parts.dateStr;
  }

  const checkIn = toMinutesFromHHMM(department?.checkInTime);
  const checkOut = toMinutesFromHHMM(department?.checkOutTime);

  if (direction === "IN") {
    return parts.minutes < checkOut
      ? previousDateString(parts.dateStr)
      : parts.dateStr;
  }

  if (direction === "OUT") {
    return parts.minutes < checkIn
      ? previousDateString(parts.dateStr)
      : parts.dateStr;
  }

  return parts.minutes < checkOut
    ? previousDateString(parts.dateStr)
    : parts.dateStr;
};

module.exports = {
  TIME_ZONE,
  getDatePartsInTimeZone,
  getDateStringInTimeZone,
  getMinutesInTimeZone,
  previousDateString,
  resolveAttendanceDate,
  shiftCrossesMidnight,
  shiftDurationMinutes,
  shiftEndThresholdMinutes,
  toMinutesFromHHMM,
};
