const Attendance = require("../modules/attendance.model");
const Employee = require("../modules/employee.model");
const {
  getDateStringInTimeZone,
  getMinutesInTimeZone,
} = require("../utils/shift.utils");

const toUtcIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

exports.getAttendance = async (req, res) => {
  try {
    const { organizationId } = req.params;
    const finalOrganizationId =
      req.role === "SUPER_ADMIN"
        ? organizationId
        : req.organizationId;

    const today = getDateStringInTimeZone(new Date());

    // 🔹 1. Hamma employee
    const employees = await Employee.find({
      organizationId: finalOrganizationId,
    }).populate("department");

    // 🔹 2. Bugungi attendance yozuvlari
    const records = await Attendance.find({
      organizationId: finalOrganizationId,
      date: today,
    });

    // 🔹 Attendance map (tez qidirish uchun)
    const recordMap = {};
    records.forEach((r) => {
      recordMap[r.employee.toString()] = r;
    });

    const result = employees.map((emp) => {
      const attendance = recordMap[emp._id.toString()];

      // ❌ Agar kelmagan bo‘lsa
      if (!attendance) {
        return {
          employee: {
            _id: emp._id,
            fullName: emp.fullName,
            employeeCode: emp.employeeCode,
            phone: emp.phone,
          },
          date: today,
          status: "Absent",
          workedMinutes: 0,
          workedTime: "0 minut",
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
        };
      }

      const totalMinutes = Math.floor((attendance.totalHours || 0) * 60);

      let status = "On Time";
      let lateMinutes = 0;

      if (emp.department && attendance.firstEntry) {
        const checkIn = emp.department.checkInTime;
        const grace = emp.department.lateAfterMinutes || 0;

        const [h, m] = checkIn.split(":");
        const checkInMinutes = parseInt(h) * 60 + parseInt(m) + grace;

        const entryMinutes = getMinutesInTimeZone(attendance.firstEntry);

        if (entryMinutes !== null && entryMinutes > checkInMinutes) {
          lateMinutes = entryMinutes - checkInMinutes;
          status = "Late";
        }
      }

      return {
        employee: {
          _id: emp._id,
          fullName: emp.fullName,
          employeeCode: emp.employeeCode,
          phone: emp.phone,
        },
        date: today,
        firstEntry: toUtcIso(attendance.firstEntry),
        lastExit: toUtcIso(attendance.lastExit),
        workedMinutes: totalMinutes,
        workedTime: `${Math.floor(totalMinutes / 60)} soat ${
          totalMinutes % 60
        } minut`,
        lateMinutes,
        status,
      };
    });

    res.json({
      success: true,
      date: today,
      totalEmployees: employees.length,
      presentCount: records.length,
      absentCount: employees.length - records.length,
      data: result,
    });
  } catch (err) {
    console.error("GET TODAY ATTENDANCE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
