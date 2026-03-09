const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Organization = require("../modules/organization.model");
const Admin = require("../modules/admin.model");

const signToken = (admin) =>
  jwt.sign(
    {
      adminId: admin._id,
      organizationId: admin.organizationId || null,
      role: admin.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );

exports.register = async (req, res) => {
  return res.status(403).json({
    success: false,
    message:
      "Bu endpoint yopilgan. Organization faqat SUPER_ADMIN orqali /auth/organization/create bilan yaratiladi",
    });
};

exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const admin = await Admin.findOne({ phone });
    if (!admin) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = signToken(admin);

    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        phone: admin.phone,
        role: admin.role,
        organizationId: admin.organizationId || null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.registerSuperAdmin = async (req, res) => {
  try {
    const { fullName, phone, password } = req.body;

    if (!fullName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "fullName, phone, password majburiy",
      });
    }

    const existingSuperAdmin = await Admin.findOne({ role: "SUPER_ADMIN" });
    if (existingSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: "Super admin allaqachon mavjud",
      });
    }

    const existing = await Admin.findOne({ phone });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Phone already registered",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await Admin.create({
      organizationId: null,
      fullName,
      phone,
      password: hashedPassword,
      role: "SUPER_ADMIN",
    });

    const token = signToken(admin);

    res.status(201).json({
      success: true,
      token,
      admin: {
        id: admin._id,
        fullName: admin.fullName,
        phone: admin.phone,
        role: admin.role,
        organizationId: null,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.createOrganizationClient = async (req, res) => {
  try {
    if (req.role !== "SUPER_ADMIN") {
      return res.status(403).json({
        success: false,
        message: "Faqat super admin organization client qo'sha oladi",
      });
    }

    const { name, orgPhone, address, fullName, phone, password } = req.body;

    if (!name || !orgPhone || !fullName || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Majburiy maydonlar to'ldirilmagan",
      });
    }

    const existingAdmin = await Admin.findOne({ phone });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: "Admin phone allaqachon ro'yxatdan o'tgan",
      });
    }

    const existingOrg = await Organization.findOne({ phone: orgPhone });
    if (existingOrg) {
      return res.status(400).json({
        success: false,
        message: "Bu telefon bilan organization mavjud",
      });
    }

    const organization = await Organization.create({
      name,
      phone: orgPhone,
      address,
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      organizationId: organization._id,
      fullName,
      phone,
      password: hashedPassword,
      role: "ORG_ADMIN",
    });

    res.status(201).json({
      success: true,
      data: {
        organization,
        admin: {
          id: admin._id,
          fullName: admin.fullName,
          phone: admin.phone,
          role: admin.role,
          organizationId: admin.organizationId,
        },
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
