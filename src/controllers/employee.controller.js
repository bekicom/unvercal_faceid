const Employee = require("../modules/employee.model");
const Department = require("../modules/department.model");
const mongoose = require("mongoose");

/* =========================
   CREATE EMPLOYEE
========================= */
exports.createEmployee = async (req, res) => {
  try {
    const {
      fullName,
      employeeCode,
      phone,
      department,
      salary,
    } = req.body;

    const finalOrganizationId = req.organizationId;

    if (!finalOrganizationId || !fullName || !employeeCode || !phone || !department) {
      return res.status(400).json({
        success: false,
        message: "Majburiy maydonlar yo‘q"
      });
    }

    if (salary !== undefined && (Number.isNaN(Number(salary)) || Number(salary) < 0)) {
      return res.status(400).json({
        success: false,
        message: "salary noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    const departmentDoc = await Department.findOne({
      _id: department,
      organizationId: finalOrganizationId,
    });

    if (!departmentDoc) {
      return res.status(400).json({
        success: false,
        message: "Department topilmadi yoki sizning organizationga tegishli emas",
      });
    }

    const employee = await Employee.create({
      organizationId: finalOrganizationId,
      fullName,
      employeeCode,
      phone,
      department,
      salary: salary !== undefined ? Number(salary) : (departmentDoc.defaultSalary || 0),
    });

    res.status(201).json({
      success: true,
      data: employee
    });

  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Bu employeeCode allaqachon mavjud",
      });
    }

    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};


/* =========================
   GET EMPLOYEES
========================= */
exports.getEmployees = async (req, res) => {
  try {
    const query = { organizationId: req.organizationId };

    const employees = await Employee.find(query).populate("department", "name");

    res.json({
      success: true,
      data: employees,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
/* =========================
   GET ONE EMPLOYEE
========================= */
exports.getOneEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Noto'g'ri employee id",
      });
    }

    const employee = await Employee.findById(id)
      .populate("department", "name");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee topilmadi"
      });
    }

    if (
      req.role !== "SUPER_ADMIN" &&
      String(employee.organizationId) !== String(req.organizationId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Faqat o'z organization xodimini ko'ra olasiz",
      });
    }

    res.json({
      success: true,
      data: employee
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


/* =========================
   UPDATE EMPLOYEE
========================= */
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fullName,
      employeeCode,
      phone,
      department,
      salary,
    } = req.body;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee topilmadi"
      });
    }

    if (
      req.role !== "SUPER_ADMIN" &&
      String(employee.organizationId) !== String(req.organizationId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Faqat o'z organization xodimini yangilay olasiz",
      });
    }

    if (salary !== undefined && (Number.isNaN(Number(salary)) || Number(salary) < 0)) {
      return res.status(400).json({
        success: false,
        message: "salary noto'g'ri (0 yoki undan katta bo'lishi kerak)",
      });
    }

    if (department) {
      const departmentDoc = await Department.findOne({
        _id: department,
        organizationId: employee.organizationId,
      });

      if (!departmentDoc) {
        return res.status(400).json({
          success: false,
          message: "Department topilmadi yoki xodim organizationiga tegishli emas",
        });
      }
    }

    employee.fullName = fullName || employee.fullName;
    employee.employeeCode = employeeCode || employee.employeeCode;
    employee.phone = phone || employee.phone;
    employee.department = department || employee.department;
    if (salary !== undefined) {
      employee.salary = Number(salary);
    }

    await employee.save();

    res.json({
      success: true,
      message: "Employee yangilandi",
      data: employee
    });

  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Bu employeeCode allaqachon mavjud",
      });
    }

    res.status(500).json({ message: "Server error" });
  }
};

/* =========================
   DELETE EMPLOYEE
========================= */
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await Employee.findById(id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee topilmadi"
      });
    }

    if (
      req.role !== "SUPER_ADMIN" &&
      String(employee.organizationId) !== String(req.organizationId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Faqat o'z organization xodimini o'chira olasiz",
      });
    }

    await employee.deleteOne();

    res.json({
      success: true,
      message: "Employee o‘chirildi"
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
