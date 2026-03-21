const Department = require("../modules/department.model");

const parseBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return Boolean(value);
};

const normalizeNonNegativeNumber = (value) => {
  const num = Number(value);
  return Number.isNaN(num) || num < 0 ? null : num;
};

const normalizeWorkDays = (workDays) => {
  if (!Array.isArray(workDays) || workDays.length === 0) return null;

  const normalized = workDays.map((day) => Number(day));
  const isValid = normalized.every(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );

  if (!isValid) return null;

  return [...new Set(normalized)].sort((a, b) => a - b);
};

exports.createDepartment = async (req, res) => {
  try {
    const {
      name,
      checkInTime,
      checkOutTime,
      lateAfterMinutes,
      earlyLeaveMinutes,
      useLatePenalty,
      useEarlyLeavePenalty,
      latePenaltyPerMinute,
      earlyLeavePenaltyPerMinute,
      useTimePenalty,
      penaltyPerMinute,
      defaultSalary,
      workDays,
    } = req.body;

    const finalOrganizationId = req.organizationId;

    if (!finalOrganizationId || !name || !checkInTime || !checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Majburiy maydonlar to‘ldirilmagan",
      });
    }

    if (
      defaultSalary !== undefined &&
      normalizeNonNegativeNumber(defaultSalary) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "defaultSalary noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      lateAfterMinutes !== undefined &&
      normalizeNonNegativeNumber(lateAfterMinutes) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "lateAfterMinutes noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      earlyLeaveMinutes !== undefined &&
      normalizeNonNegativeNumber(earlyLeaveMinutes) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "earlyLeaveMinutes noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      latePenaltyPerMinute !== undefined &&
      normalizeNonNegativeNumber(latePenaltyPerMinute) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "latePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      earlyLeavePenaltyPerMinute !== undefined &&
      normalizeNonNegativeNumber(earlyLeavePenaltyPerMinute) === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "earlyLeavePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      penaltyPerMinute !== undefined &&
      normalizeNonNegativeNumber(penaltyPerMinute) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "penaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (workDays !== undefined) {
      const normalizedWorkDays = normalizeWorkDays(workDays);
      if (!normalizedWorkDays) {
        return res.status(400).json({
          success: false,
          message: "workDays noto'g'ri. Misol: [1,2,3,4,5,6]",
        });
      }
    }

    const department = await Department.create({
      organizationId: finalOrganizationId,
      name,
      checkInTime,
      checkOutTime,
      lateAfterMinutes:
        lateAfterMinutes !== undefined
          ? normalizeNonNegativeNumber(lateAfterMinutes)
          : 0,
      earlyLeaveMinutes:
        earlyLeaveMinutes !== undefined
          ? normalizeNonNegativeNumber(earlyLeaveMinutes)
          : 0,
      useLatePenalty:
        useLatePenalty !== undefined ? parseBoolean(useLatePenalty) : false,
      useEarlyLeavePenalty:
        useEarlyLeavePenalty !== undefined
          ? parseBoolean(useEarlyLeavePenalty)
          : false,
      latePenaltyPerMinute:
        latePenaltyPerMinute !== undefined
          ? normalizeNonNegativeNumber(latePenaltyPerMinute)
          : 0,
      earlyLeavePenaltyPerMinute:
        earlyLeavePenaltyPerMinute !== undefined
          ? normalizeNonNegativeNumber(earlyLeavePenaltyPerMinute)
          : 0,
      useTimePenalty:
        useTimePenalty !== undefined ? parseBoolean(useTimePenalty) : false,
      penaltyPerMinute:
        penaltyPerMinute !== undefined
          ? normalizeNonNegativeNumber(penaltyPerMinute)
          : 0,
      defaultSalary:
        defaultSalary !== undefined ? normalizeNonNegativeNumber(defaultSalary) : 0,
      workDays: workDays !== undefined ? normalizeWorkDays(workDays) : undefined,
    });

    return res.status(201).json({
      success: true,
      data: department,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Bu bo'lim nomi allaqachon mavjud",
      });
    }

    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
};


exports.getDepartments = async (req, res) => {
  try {
    const finalOrganizationId = req.organizationId;

    const departments = await Department.find({
      organizationId: finalOrganizationId,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
};


exports.getAllDepartments = async (req, res) => {
  try {
    const query = { organizationId: req.organizationId };

    const departments = await Department.find(query)
      .populate("organizationId", "name")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: departments.length,
      data: departments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
};

// 🔹 UPDATE DEPARTMENT
const mongoose = require("mongoose");

exports.updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Noto‘g‘ri ID",
      });
    }

    const allowedFields = [
      "name",
      "checkInTime",
      "checkOutTime",
      "lateAfterMinutes",
      "earlyLeaveMinutes",
      "useLatePenalty",
      "useEarlyLeavePenalty",
      "latePenaltyPerMinute",
      "earlyLeavePenaltyPerMinute",
      "useTimePenalty",
      "penaltyPerMinute",
      "defaultSalary",
      "workDays",
    ];

    const bodyKeys = Object.keys(req.body);

    const invalidField = bodyKeys.find((key) => !allowedFields.includes(key));

    if (invalidField) {
      return res.status(400).json({
        success: false,
        message: `Ruxsat etilmagan field: ${invalidField}`,
      });
    }

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department topilmadi",
      });
    }

    if (
      req.role !== "SUPER_ADMIN" &&
      String(department.organizationId) !== String(req.organizationId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Faqat o'z organization bo'limini yangilay olasiz",
      });
    }

    // ⏰ Time format validation (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (req.body.checkInTime && !timeRegex.test(req.body.checkInTime)) {
      return res.status(400).json({
        success: false,
        message: "checkInTime noto‘g‘ri format (HH:MM)",
      });
    }

    if (req.body.checkOutTime && !timeRegex.test(req.body.checkOutTime)) {
      return res.status(400).json({
        success: false,
        message: "checkOutTime noto‘g‘ri format (HH:MM)",
      });
    }

    if (
      req.body.defaultSalary !== undefined &&
      normalizeNonNegativeNumber(req.body.defaultSalary) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "defaultSalary noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.lateAfterMinutes !== undefined &&
      normalizeNonNegativeNumber(req.body.lateAfterMinutes) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "lateAfterMinutes noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.earlyLeaveMinutes !== undefined &&
      normalizeNonNegativeNumber(req.body.earlyLeaveMinutes) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "earlyLeaveMinutes noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.latePenaltyPerMinute !== undefined &&
      normalizeNonNegativeNumber(req.body.latePenaltyPerMinute) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "latePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.earlyLeavePenaltyPerMinute !== undefined &&
      normalizeNonNegativeNumber(req.body.earlyLeavePenaltyPerMinute) === null
    ) {
      return res.status(400).json({
        success: false,
        message:
          "earlyLeavePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.penaltyPerMinute !== undefined &&
      normalizeNonNegativeNumber(req.body.penaltyPerMinute) === null
    ) {
      return res.status(400).json({
        success: false,
        message: "penaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (req.body.workDays !== undefined) {
      const normalizedWorkDays = normalizeWorkDays(req.body.workDays);
      if (!normalizedWorkDays) {
        return res.status(400).json({
          success: false,
          message: "workDays noto'g'ri. Misol: [1,2,3,4,5,6]",
        });
      }
    }

    // Update qilish
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        department[field] =
          field === "defaultSalary" ||
          field === "lateAfterMinutes" ||
          field === "earlyLeaveMinutes" ||
          field === "latePenaltyPerMinute" ||
          field === "earlyLeavePenaltyPerMinute" ||
          field === "penaltyPerMinute"
            ? normalizeNonNegativeNumber(req.body[field])
            : field === "useLatePenalty" ||
                field === "useEarlyLeavePenalty" ||
                field === "useTimePenalty"
              ? parseBoolean(req.body[field])
              : field === "workDays"
                ? normalizeWorkDays(req.body[field])
            : req.body[field];
      }
    });

    await department.save();

    res.json({
      success: true,
      message: "Department yangilandi",
      data: department,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Bu bo'lim nomi allaqachon mavjud",
      });
    }

    console.error("UPDATE DEPARTMENT ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
};


// 🔹 DELETE DEPARTMENT (Hard delete)
exports.deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: "Department topilmadi",
      });
    }

    if (
      req.role !== "SUPER_ADMIN" &&
      String(department.organizationId) !== String(req.organizationId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Faqat o'z organization bo'limini o'chira olasiz",
      });
    }

    await department.deleteOne();

    res.json({
      success: true,
      message: "Department o‘chirildi",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server xatosi",
    });
  }
};
