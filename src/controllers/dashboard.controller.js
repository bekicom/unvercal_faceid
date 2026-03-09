const Employee = require("../modules/employee.model");
const Attendance = require("../modules/attendance.model");
const mongoose = require("mongoose");
const {
  getDateStringInTimeZone,
  getMinutesInTimeZone,
} = require("../utils/shift.utils");

/* =========================================
   DAILY DASHBOARD
   GET /dashboard/:organizationId?date=2026-02-21
========================================= */
exports.getDailyDashboard = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const { date } = req.query;
    const finalOrganizationId =
      req.role === "SUPER_ADMIN"
        ? organizationId
        : req.organizationId;

    const today = date || getDateStringInTimeZone(new Date());

    const employees = await Employee.find({
      organizationId: finalOrganizationId,
    }).populate("department", "name checkInTime checkOutTime lateAfterMinutes earlyLeaveMinutes");

    // 2️⃣ shu kundagi attendance
    const records = await Attendance.find({
      organizationId: finalOrganizationId,
      date: today,
    }).populate("department");

    const recordMap = {};
    records.forEach((r) => {
      recordMap[r.employee.toString()] = r;
    });

    const attendanceList = [];
    let lateCount = 0;
    let presentCount = 0;

    employees.forEach((emp) => {
      const rec = recordMap[emp._id.toString()];

      if (!rec) {
        attendanceList.push({
          employeeId: emp._id,
          fullName: emp.fullName,
          employeeCode: emp.employeeCode,
          department: emp.department?.name || null,
          firstEntry: null,
          lastExit: null,
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          status: "Absent",
        });
        return;
      }

      presentCount++;

      let lateMinutes = 0;
      let earlyLeaveMinutes = 0;
      let status = "Present";

      if (emp.department && rec.firstEntry) {
        const checkIn = emp.department.checkInTime; // "09:00"
        const grace = emp.department.lateAfterMinutes || 0;

        const [h, m] = checkIn.split(":");
        const checkInMinutes = parseInt(h) * 60 + parseInt(m) + grace;

        const entryMinutes = getMinutesInTimeZone(rec.firstEntry);

        if (entryMinutes !== null && entryMinutes > checkInMinutes) {
          lateMinutes = entryMinutes - checkInMinutes;
          lateCount++;
          status = "Late";
        }
      }

      if (emp.department && rec.lastExit) {
        const checkOut = emp.department.checkOutTime;
        const earlyAllowed = emp.department.earlyLeaveMinutes || 0;
        const [h, m] = checkOut.split(":");
        const checkOutMinutes = parseInt(h) * 60 + parseInt(m) - earlyAllowed;

        const exitMinutes = getMinutesInTimeZone(rec.lastExit);
        if (exitMinutes !== null && checkOutMinutes > 0 && exitMinutes < checkOutMinutes) {
          earlyLeaveMinutes = checkOutMinutes - exitMinutes;
          if (status === "Present") status = "Early Leave";
        }
      }

      attendanceList.push({
        employeeId: emp._id,
        fullName: emp.fullName,
        employeeCode: emp.employeeCode,
        department: emp.department?.name || null,
        firstEntry: rec.firstEntry || null,
        lastExit: rec.lastExit || null,
        lateMinutes,
        earlyLeaveMinutes,
        status,
      });
    });

    const totalEmployees = employees.length;
    const absentCount = totalEmployees - presentCount;

    attendanceList.sort((a, b) => a.fullName.localeCompare(b.fullName));

    res.json({
      success: true,
      data: {
        date: today,
        totalEmployees,
        presentCount,
        lateCount,
        absentCount,
        attendanceList,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

/* =========================================
   EMPLOYEE MONTHLY STATS
   GET /dashboard/employee/:employeeId?year=2026&month=2
========================================= */

exports.getEmployeeMonthlyStats = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "year va month majburiy",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "Noto‘g‘ri employeeId",
      });
    }

    const employee = await Employee.findById(employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee topilmadi",
      });
    }

    if (
      req.role !== "SUPER_ADMIN" &&
      String(employee.organizationId) !== String(req.organizationId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Faqat o'z organization xodimi statistikasini ko'ra olasiz",
      });
    }

    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endDate = `${year}-${month.padStart(2, "0")}-31`;

    const records = await Attendance.find({
      employee: employeeId,
      date: { $gte: startDate, $lte: endDate },
    }).populate("department");

    let totalMinutes = 0;
    let lateDays = 0;
    let lateMinutesTotal = 0;

    const dailyDetails = [];

    records.forEach((r) => {
      const workedMinutes = Math.floor((r.totalHours || 0) * 60);
      totalMinutes += workedMinutes;

      let lateMinutes = 0;
      let isLate = false;

      if (r.firstEntry && r.department) {
        const checkIn = r.department.checkInTime;
        const grace = r.department.lateAfterMinutes || 0;

        const [h, m] = checkIn.split(":");
        const checkInMinutes = parseInt(h) * 60 + parseInt(m) + grace;

        const entryMinutes = getMinutesInTimeZone(r.firstEntry);

        if (entryMinutes !== null && entryMinutes > checkInMinutes) {
          isLate = true;
          lateDays++;
          lateMinutes = entryMinutes - checkInMinutes;
          lateMinutesTotal += lateMinutes;
        }
      }

      dailyDetails.push({
        date: r.date,
        firstEntry: r.firstEntry,
        lastExit: r.lastExit,
        workedMinutes,
        workedTime: `${Math.floor(workedMinutes / 60)} soat ${
          workedMinutes % 60
        } minut`,
        isLate,
        lateMinutes,
        lateTime: `${Math.floor(lateMinutes / 60)} soat ${
          lateMinutes % 60
        } minut`,
      });
    });

    const workedHours = Math.floor(totalMinutes / 60);
    const workedRemainingMinutes = totalMinutes % 60;

    const lateHours = Math.floor(lateMinutesTotal / 60);
    const lateRemainingMinutes = lateMinutesTotal % 60;

    res.json({
      success: true,
      data: {
        summary: {
          presentDays: records.length,
          lateDays,
          totalWorkedMinutes: totalMinutes,
          totalWorkedTime: `${workedHours} soat ${workedRemainingMinutes} minut`,
          totalLateMinutes: lateMinutesTotal,
          totalLateTime: `${lateHours} soat ${lateRemainingMinutes} minut`,
        },
        dailyDetails,
      },
    });
  } catch (err) {
    console.error("MONTHLY STATS ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
