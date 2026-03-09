const crypto = require("crypto");
const mongoose = require("mongoose");
const Device = require("../modules/device.model");
const Organization = require("../modules/organization.model");
const Employee = require("../modules/employee.model"); // 🔥 SHU YO‘Q
const Attendance = require("../modules/attendance.model"); // 🔥 SHU YO‘Q EDI
const {
  resolveAttendanceDate,
} = require("../utils/shift.utils");
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

const extractXmlField = (text, fieldNames) => {
  if (!text || typeof text !== "string") return null;

  for (const fieldName of fieldNames) {
    const regex = new RegExp(`<${fieldName}>([^<]+)</${fieldName}>`, "i");
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
};

const pickFirstValue = (obj, fieldNames) => {
  const value = findField(obj, fieldNames);

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
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

const extractEventPayload = (req) => {
  let data = null;
  let rawText = null;

  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const fileText = file.buffer.toString();
      rawText = rawText || fileText;

      try {
        data = JSON.parse(fileText);
        break;
      } catch {}
    }
  }

  if (!data && typeof req.body === "string" && req.body.trim()) {
    rawText = req.body;

    try {
      data = JSON.parse(req.body);
    } catch {}
  }

  if (
    !data &&
    req.body &&
    typeof req.body === "object" &&
    Object.keys(req.body).length > 0
  ) {
    try {
      const firstKey = Object.keys(req.body)[0];
      const firstValue = req.body[firstKey];

      if (typeof firstValue === "string") {
        rawText = rawText || firstValue;
        data = JSON.parse(firstValue);
      } else {
        data = req.body;
      }
    } catch {
      data = req.body;
    }
  }

  if (!data && rawText) {
    const employeeNo = extractXmlField(rawText, [
      "employeeNoString",
      "employeeNo",
      "EmployeeNo",
      "employeeID",
      "jobNo",
      "userId",
      "cardNo",
      "CardNo",
    ]);
    const employeeName = extractXmlField(rawText, [
      "name",
      "employeeName",
      "userName",
      "personName",
    ]);
    const dateTime =
      extractXmlField(rawText, ["dateTime", "DateTime"]) ||
      new Date().toISOString();

    return { employeeNo, employeeName, dateTime, rawText, data: null };
  }

  if (!data) {
    return {
      employeeNo: null,
      employeeName: null,
      dateTime: null,
      rawText: null,
      data: null,
    };
  }

  const employeeNo = pickFirstValue(data, [
    "employeeNoString",
    "employeeNo",
    "EmployeeNo",
    "employeeID",
    "jobNo",
    "userId",
    "cardNo",
    "CardNo",
  ]);
  const employeeName = pickFirstValue(data, [
    "name",
    "employeeName",
    "userName",
    "personName",
  ]);

  const dateTime =
    findField(data, ["dateTime", "DateTime"]) || new Date().toISOString();

  return { employeeNo, employeeName, dateTime, rawText, data };
};

const resolveOrganizationId = (req) => {
  if (req.role === "SUPER_ADMIN") {
    return req.body.organizationId || req.query.organizationId || null;
  }
  return req.organizationId || null;
};

/* =========================
   CREATE DEVICE
========================= */
exports.createDevice = async (req, res) => {
  try {
    const { name, floor, direction, locationDescription } = req.body;
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId kerak",
      });
    }

    // 🔥 Unique device key generatsiya
    const deviceKey = crypto.randomBytes(6).toString("hex");

    const device = await Device.create({
      organizationId,
      name,
      floor,
      direction,
      locationDescription,
      deviceKey,
    });

    res.status(201).json({
      success: true,
      data: device,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   GET DEVICES (faqat o'z organization)
========================= */
exports.getDevices = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId kerak",
      });
    }

    const devices = await Device.find({
      organizationId,
    });

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   ASSIGN ENTRY/EXIT DEVICES
========================= */
exports.assignGateDevices = async (req, res) => {
  try {
    const { entryDeviceId, exitDeviceId } = req.body;
    const organizationId = resolveOrganizationId(req);

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId kerak",
      });
    }

    if (!entryDeviceId) {
      return res.status(400).json({
        success: false,
        message: "entryDeviceId majburiy",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(entryDeviceId)) {
      return res.status(400).json({
        success: false,
        message: "entryDeviceId noto'g'ri",
      });
    }

    // SINGLE MODE: bitta qurilma kirish+chiqish uchun
    if (!exitDeviceId) {
      const device = await Device.findOne({
        _id: entryDeviceId,
        organizationId,
        isActive: true,
      });

      if (!device) {
        return res.status(400).json({
          success: false,
          message: "Device sizning organizationga tegishli emas yoki inactive",
        });
      }

      await Device.updateOne({ _id: entryDeviceId }, { direction: "BOTH" });

      const organization = await Organization.findByIdAndUpdate(
        organizationId,
        {
          entryDevice: entryDeviceId,
          exitDevice: null,
        },
        { new: true },
      )
        .populate("entryDevice", "name deviceKey direction floor locationDescription")
        .populate("exitDevice", "name deviceKey direction floor locationDescription");

      return res.status(200).json({
        success: true,
        message: "Single device rejimi o'rnatildi (IN/OUT bitta qurilmada)",
        data: {
          organizationId: organization?._id,
          mode: "SINGLE",
          entryDevice: organization?.entryDevice || null,
          exitDevice: organization?.exitDevice || null,
        },
      });
    }

    // DUAL MODE: alohida IN va OUT
    if (!mongoose.Types.ObjectId.isValid(exitDeviceId)) {
      return res.status(400).json({
        success: false,
        message: "exitDeviceId noto'g'ri",
      });
    }

    if (entryDeviceId === exitDeviceId) {
      return res.status(400).json({
        success: false,
        message: "DUAL rejimda entry va exit qurilma bir xil bo'lishi mumkin emas",
      });
    }

    const devices = await Device.find({
      _id: { $in: [entryDeviceId, exitDeviceId] },
      organizationId,
      isActive: true,
    });

    if (devices.length !== 2) {
      return res.status(400).json({
        success: false,
        message: "Ikkala device ham sizning organizationga tegishli bo‘lishi kerak",
      });
    }

    await Device.updateOne({ _id: entryDeviceId }, { direction: "IN" });
    await Device.updateOne({ _id: exitDeviceId }, { direction: "OUT" });

    const organization = await Organization.findByIdAndUpdate(
      organizationId,
      {
        entryDevice: entryDeviceId,
        exitDevice: exitDeviceId,
      },
      { new: true },
    )
      .populate("entryDevice", "name deviceKey direction floor locationDescription")
      .populate("exitDevice", "name deviceKey direction floor locationDescription");

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization topilmadi",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dual device rejimi o'rnatildi (IN/OUT alohida)",
      data: {
        organizationId: organization._id,
        mode: "DUAL",
        entryDevice: organization.entryDevice,
        exitDevice: organization.exitDevice,
      },
    });
  } catch (error) {
    console.error("ASSIGN GATE DEVICES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================
   GET ENTRY/EXIT DEVICES
========================= */
exports.getGateDevices = async (req, res) => {
  try {
    const organizationId = resolveOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: "organizationId kerak",
      });
    }

    const organization = await Organization.findById(organizationId)
      .populate("entryDevice", "name deviceKey direction floor locationDescription")
      .populate("exitDevice", "name deviceKey direction floor locationDescription");

    if (!organization) {
      return res.status(404).json({
        success: false,
        message: "Organization topilmadi",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        organizationId: organization._id,
        mode: organization.exitDevice ? "DUAL" : "SINGLE",
        entryDevice: organization.entryDevice,
        exitDevice: organization.exitDevice,
      },
    });
  } catch (error) {
    console.error("GET GATE DEVICES ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================
   DEVICE EVENT (PUBLIC)
========================= */
exports.deviceEvent = async (req, res) => {
  try {
    const { key } = req.params;
    const { employeeNo, employeeName, dateTime, rawText, data } =
      extractEventPayload(req);

    if ((!employeeNo && !employeeName) || !dateTime || !key) {
      console.log("⚠️ Device event skipped:", {
        key,
        contentType: req.headers["content-type"] || null,
        bodyType: typeof req.body,
        bodyKeys:
          req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
        filesCount: Array.isArray(req.files) ? req.files.length : 0,
        candidateEmployeeNo: employeeNo,
        candidateEmployeeName: employeeName,
        parsedTopLevelKeys: data && typeof data === "object" ? Object.keys(data) : [],
        rawPreview: rawText ? rawText.slice(0, 300) : null,
      });

      return res.status(200).send("OK");
    }

    const device = await Device.findOne({
      deviceKey: key,
      isActive: true,
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: "Device topilmadi",
      });
    }

    const organizationId = device.organizationId;

    const employeeQuery = {
      organizationId,
      isActive: true,
    };

    if (employeeNo) {
      employeeQuery.employeeCode = employeeNo;
    } else if (employeeName) {
      employeeQuery.fullName = employeeName;
    }

    let employee = await Employee.findOne(employeeQuery).populate("department");

    if (!employee && employeeNo && employeeName) {
      employee = await Employee.findOne({
        organizationId,
        fullName: employeeName,
        isActive: true,
      }).populate("department");
    }

    if (!employee) {
      console.log("❌ Employee topilmadi:", {
        employeeNo,
        employeeName,
        organizationId: String(organizationId),
      });

      return res.status(200).send("OK");
    }

    const eventTime = new Date(dateTime);
    if (Number.isNaN(eventTime.getTime())) {
      return res.status(400).json({
        success: false,
        message: "dateTime noto'g'ri",
      });
    }

    const attendanceDate = resolveAttendanceDate(
      employee.department,
      device.direction,
      eventTime,
    );

    if (!attendanceDate) {
      return res.status(400).json({
        success: false,
        message: "Attendance sanasini aniqlab bo'lmadi",
      });
    }

    let attendance = await Attendance.findOne({
      organizationId,
      employee: employee._id,
      date: attendanceDate,
    });

    // 1) Attendance bo'lmasa faqat IN/BOTH kirishni qabul qilamiz
    if (!attendance) {
      if (device.direction === "OUT") {
        return res.status(200).json({
          success: true,
          message: "OUT qurilmada check-insiz check-out qilinmaydi",
        });
      }

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

      console.log(`✅ ${employee.fullName} → IN`);

      return res.status(200).json({
        success: true,
        message: "Check-in yozildi",
      });
    }

    // 2) Double scan protection
    const lastMarkTime = getLastAttendanceMarkTime(attendance);
    const diff = (eventTime - lastMarkTime) / 1000;

    if (diff < MIN_RESCAN_SECONDS) {
      console.log("⚠️ Double scan ignored");
      return res.status(200).json({
        success: true,
        message: "Double scan ignored",
      });
    }

    // 3) IN qurilmada yangi interval ochamiz yoki qayta scan'ni ignore qilamiz
    if (device.direction === "IN") {
      if (attendance.currentEntry) {
        return res.status(200).json({
          success: true,
          message: "IN qurilma: hodim allaqachon ichkarida",
        });
      }

      openAttendanceSession(attendance, eventTime);
      await attendance.save();

      return res.status(200).json({
        success: true,
        message: "Qayta kirish yozildi",
      });
    }

    if (device.direction === "OUT") {
      if (!attendance.currentEntry) {
        return res.status(200).json({
          success: true,
          message: "OUT qurilma: hodim allaqachon tashqarida",
        });
      }

      closeAttendanceSession(attendance, eventTime);
      await attendance.save();

      console.log(`🚪 ${employee.fullName} → OUT`);

      return res.status(200).json({
        success: true,
        message: "Check-out yozildi",
      });
    }

    // 4) BOTH qurilmada holatni toggle qilamiz
    if (attendance.currentEntry) {
      closeAttendanceSession(attendance, eventTime);
      await attendance.save();

      return res.status(200).json({
        success: true,
        message: "Check-out yozildi",
      });
    }

    openAttendanceSession(attendance, eventTime);
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: "Qayta kirish yozildi",
    });

    return res.status(200).json({
      success: true,
      message: "Allaqachon chiqib ketgan",
    });
  } catch (error) {
    console.error("Device Event Error:", error);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
};

 
