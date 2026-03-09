const express = require("express");
const router = express.Router();
const textBodyParser = express.text({
  type: ["text/*", "application/xml", "text/xml", "application/octet-stream"],
});
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

const authController = require("../controllers/auth.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");
const deviceController = require("../controllers/device.controller");
const employeeid = require("../controllers/employee.controller");
const departmentController = require("../controllers/department.controller");
const hikvisionController = require("../controllers/hikvision.controller");
const attendanceController = require("../controllers/attendance.controller");
const organizationController = require("../controllers/organization.controller");
const dashboardController = require("../controllers/dashboard.controller");
const payrollController = require("../controllers/payroll.controller");



router.post("/auth/register", authController.register);
router.post("/auth/super-admin/register", authController.registerSuperAdmin);
router.post("/auth/login", authController.login);
router.post(
  "/auth/organization/create",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  authController.createOrganizationClient,
);
router.get(
  "/device/list",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  deviceController.getDevices,
);
router.post(
  "/device/create",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  deviceController.createDevice,
);
router.post(
  "/device/assign-gates",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  deviceController.assignGateDevices,
);
router.get(
  "/device/gates",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  deviceController.getGateDevices,
);
router.post(
  "/device/event/:key",
  textBodyParser,
  upload.any(),
  deviceController.deviceEvent,
);
router.post(
  "/employee/create",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  employeeid.createEmployee,
);
router.get(
  "/employee/list",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  employeeid.getEmployees,
);
router.get(
  "/employee/:id",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  employeeid.getOneEmployee,
);
router.put(
  "/employee/:id",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  employeeid.updateEmployee,
);
router.delete(
  "/employee/:id",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  employeeid.deleteEmployee,
);



router.post(
  "/departments",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  departmentController.createDepartment,
);
router.get(
  "/departments/:organizationId",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  departmentController.getDepartments,
);
router.get(
  "/departments",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  departmentController.getAllDepartments,
);
router.put(
  "/departments/:id",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  departmentController.updateDepartment,
);
router.delete(
  "/departments/:id",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  departmentController.deleteDepartment,
);

// ================= ORGANIZATIONS =================

router.post(
  "/organizations",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  organizationController.createOrganization,
);
router.get("/organizations", authMiddleware, organizationController.getOrganizations);
router.get("/organizations/:id", authMiddleware, organizationController.getOneOrganization);
router.put("/organizations/:id", authMiddleware, organizationController.updateOrganization);
router.delete(
  "/organizations/:id",
  authMiddleware,
  roleMiddleware("SUPER_ADMIN"),
  organizationController.deleteOrganization,
);
router.post(
  "/hikvision/event/:organizationId",
  upload.any(),
  hikvisionController.deviceEvent,
);
router.get(
  "/attendance/:organizationId",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  attendanceController.getAttendance,
);



router.get(
  "/dashboard/:organizationId",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  dashboardController.getDailyDashboard,
);
router.get(
  "/dashboard/employee/:employeeId",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  dashboardController.getEmployeeMonthlyStats,
);
router.get(
  "/payroll/:organizationId",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  payrollController.getMonthlyPayroll,
);
router.post(
  "/payroll/:organizationId/employee/:employeeId/payments",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  payrollController.addEmployeePayment,
);
router.get(
  "/payroll/:organizationId/employee/:employeeId/ledger",
  authMiddleware,
  roleMiddleware("ORG_ADMIN"),
  payrollController.getEmployeePayrollLedger,
);




router.get("/me", authMiddleware, (req, res) => {
  res.json({
    success: true,
    adminId: req.adminId,
    organizationId: req.organizationId,
    role: req.role,
  });
});

module.exports = router;
