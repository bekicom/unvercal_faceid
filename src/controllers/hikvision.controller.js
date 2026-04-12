const Employee = require("../modules/employee.model");
const Attendance = require("../modules/attendance.model");
const { resolveAttendanceDate } = require("../utils/shift.utils");
const MIN_RESCAN_SECONDS = 5 * 60;

const getLastAttendanceMarkTime = (attendance) =>
  attendance.currentEntry || attendance.lastExit || attendance.firstEntry;

const openAttendanceSession = (attendance, entryTime) => {
  if (!attendance.firstEntry) {
    attendance.firstEntry = entryTime;
  }

  attendance.currentEntry = entryTime;
};

const closeAttendanceSession = (attendance, exitTime) => {
  if (!attendance.currentEntry) return false;

  const sessionMs = exitTime - attendance.currentEntry;
  const safeSessionMs = sessionMs > 0 ? sessionMs : 0;

  attendance.lastExit = exitTime;
  attendance.totalHours += safeSessionMs / (1000 * 60 * 60);
  attendance.currentEntry = null;

  return true;
};

const findField = (obj, fieldNames) => {
  if (!obj || typeof obj !== "object") return null;

  for (const key of Object.keys(obj)) {
    if (fieldNames.includes(key)) {
      return obj[key];
    }

    if (typeof obj[key] === "object") {
      const result = findField(obj[key], fieldNames);
      if (result) return result;
    }
  }

  return null;
};

const extractXmlField = (xml, fieldNames) => {
  if (!xml || typeof xml !== "string") return null;

  for (const field of fieldNames) {
    const regex = new RegExp(
      `<(?:\\w+:)?${field}[^>]*>([^<]+)</(?:\\w+:)?${field}>`,
      "i",
    );
    const match = xml.match(regex);
    if (match && match[1]) {
      return String(match[1]).trim();
    }
  }

  return null;
};

const parseTextPayload = (raw) => {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {}

  const employeeNo =
    extractXmlField(trimmed, ["employeeNoString"]) ||
    extractXmlField(trimmed, ["employeeNo", "EmployeeNo", "cardNo", "CardNo"]);
  const dateTime = extractXmlField(trimmed, ["dateTime", "DateTime"]);
  const eventType = extractXmlField(trimmed, ["eventType", "EventType"]);

  if (!employeeNo && !dateTime && !eventType) {
    return null;
  }

  return {
    employeeNoString: employeeNo,
    dateTime,
    eventType,
  };
};

const parseDevicePayload = (req) => {
  let data = null;

  // 1) Multipart payload (Hikvision)
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const raw = file?.buffer?.toString?.();
      if (!raw) continue;

      const parsed = parseTextPayload(raw);
      if (parsed) {
        data = parsed;
        break;
      }
    }
  }

  // 2) Raw text / XML / JSON string
  if (!data && typeof req.body === "string") {
    data = parseTextPayload(req.body);
  }

  // 3) JSON object
  if (
    !data &&
    req.body &&
    typeof req.body === "object" &&
    Object.keys(req.body).length > 0
  ) {
    const firstKey = Object.keys(req.body)[0];
    const firstValue = req.body[firstKey];

    if (typeof firstValue === "string") {
      data = parseTextPayload(firstValue);
    }

    if (!data) {
      data = req.body;
    }
  }

  return data;
};

exports.deviceEvent = async (req, res) => {
  try {
    const { organizationId } = req.params;

    const data = parseDevicePayload(req);

    if (!data) return res.status(200).send("OK");

    if (data.eventType === "heartBeat") {
      return res.status(200).send("OK");
    }

    const employeeNo = findField(data, [
      "employeeNoString",
      "employeeNo",
      "EmployeeNo",
      "cardNo",
      "CardNo",
    ]);

    if (!employeeNo) {
      return res.status(200).send("OK");
    }

    const dateTime =
      findField(data, ["dateTime", "DateTime"]) || new Date().toISOString();

    const eventTime = new Date(dateTime);
    const employee = await Employee.findOne({
      organizationId,
      employeeCode: employeeNo,
      isActive: true,
    }).populate("department");

    if (!employee) {
      console.log("❌ Employee topilmadi:", employeeNo);
      return res.status(200).send("OK");
    }

    const attendanceDate = resolveAttendanceDate(
      employee.department,
      "BOTH",
      eventTime,
    );

    if (!attendanceDate) {
      return res.status(200).send("OK");
    }

    let attendance = await Attendance.findOne({
      organizationId,
      employee: employee._id,
      date: attendanceDate,
    });

    // 🟢 FIRST ENTRY
    if (!attendance) {
      await Attendance.create({
        organizationId,
        employee: employee._id,
        department: employee.department._id,
        date: attendanceDate,
        firstEntry: eventTime,
        currentEntry: eventTime,
        lastExit: null,
        totalHours: 0,
      });

      console.log("===================================");
      console.log("🏢 Filial:", organizationId);
      console.log("🏬 Bo‘lim:", employee.department?.name);
      console.log("👤 Hodim:", employee.fullName);
      console.log("🆔 Code:", employee.employeeCode);
      console.log("🟢 FIRST ENTRY:", eventTime);
      console.log("===================================");
    }

    // 🔄 UPDATED EXIT
    else {
      const lastMarkTime = getLastAttendanceMarkTime(attendance);
      const diffSeconds = (eventTime - lastMarkTime) / 1000;

      // ⚠️ Double scan protection (5 min)
      if (diffSeconds < MIN_RESCAN_SECONDS) {
        return res.status(200).send("OK");
      }

      if (attendance.currentEntry) {
        closeAttendanceSession(attendance, eventTime);
      } else {
        openAttendanceSession(attendance, eventTime);
      }

      await attendance.save();

      console.log("===================================");
      console.log("🏢 Filial:", organizationId);
      console.log("🏬 Bo‘lim:", employee.department?.name);
      console.log("👤 Hodim:", employee.fullName);
      console.log("🆔 Code:", employee.employeeCode);
      console.log(
        attendance.currentEntry ? "🟢 RE-ENTRY:" : "🔄 UPDATED EXIT:",
        eventTime,
      );
      console.log("⏱ Umumiy soat:", attendance.totalHours.toFixed(2));
      console.log("===================================");
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("Device Error:", err);
    return res.status(200).send("OK");
  }
};
