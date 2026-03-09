const Department = require("../modules/department.model");

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

    if (defaultSalary !== undefined && (Number.isNaN(Number(defaultSalary)) || Number(defaultSalary) < 0)) {
      return res.status(400).json({
        success: false,
        message: "defaultSalary noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      latePenaltyPerMinute !== undefined &&
      (Number.isNaN(Number(latePenaltyPerMinute)) ||
        Number(latePenaltyPerMinute) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "latePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      earlyLeavePenaltyPerMinute !== undefined &&
      (Number.isNaN(Number(earlyLeavePenaltyPerMinute)) ||
        Number(earlyLeavePenaltyPerMinute) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "earlyLeavePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      penaltyPerMinute !== undefined &&
      (Number.isNaN(Number(penaltyPerMinute)) || Number(penaltyPerMinute) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "penaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (workDays !== undefined) {
      const ok =
        Array.isArray(workDays) &&
        workDays.length > 0 &&
        workDays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
      if (!ok) {
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
      lateAfterMinutes: lateAfterMinutes || 0,
      earlyLeaveMinutes: earlyLeaveMinutes || 0,
      useLatePenalty: useLatePenalty !== undefined ? Boolean(useLatePenalty) : false,
      useEarlyLeavePenalty:
        useEarlyLeavePenalty !== undefined ? Boolean(useEarlyLeavePenalty) : false,
      latePenaltyPerMinute:
        latePenaltyPerMinute !== undefined ? Number(latePenaltyPerMinute) : 0,
      earlyLeavePenaltyPerMinute:
        earlyLeavePenaltyPerMinute !== undefined
          ? Number(earlyLeavePenaltyPerMinute)
          : 0,
      useTimePenalty: useTimePenalty !== undefined ? Boolean(useTimePenalty) : false,
      penaltyPerMinute: penaltyPerMinute !== undefined ? Number(penaltyPerMinute) : 0,
      defaultSalary: defaultSalary !== undefined ? Number(defaultSalary) : 0,
      workDays: workDays !== undefined ? workDays : undefined,
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
      (Number.isNaN(Number(req.body.defaultSalary)) ||
        Number(req.body.defaultSalary) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "defaultSalary noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.latePenaltyPerMinute !== undefined &&
      (Number.isNaN(Number(req.body.latePenaltyPerMinute)) ||
        Number(req.body.latePenaltyPerMinute) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "latePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.earlyLeavePenaltyPerMinute !== undefined &&
      (Number.isNaN(Number(req.body.earlyLeavePenaltyPerMinute)) ||
        Number(req.body.earlyLeavePenaltyPerMinute) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "earlyLeavePenaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (
      req.body.penaltyPerMinute !== undefined &&
      (Number.isNaN(Number(req.body.penaltyPerMinute)) ||
        Number(req.body.penaltyPerMinute) < 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "penaltyPerMinute noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (req.body.workDays !== undefined) {
      const ok =
        Array.isArray(req.body.workDays) &&
        req.body.workDays.length > 0 &&
        req.body.workDays.every(
          (d) => Number.isInteger(d) && d >= 0 && d <= 6,
        );
      if (!ok) {
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
          field === "latePenaltyPerMinute" ||
          field === "earlyLeavePenaltyPerMinute" ||
          field === "penaltyPerMinute"
            ? Number(req.body[field])
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
