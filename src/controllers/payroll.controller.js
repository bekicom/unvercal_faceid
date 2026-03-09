const mongoose = require("mongoose");
const Employee = require("../modules/employee.model");
const Attendance = require("../modules/attendance.model");
const PayrollRecord = require("../modules/payrollRecord.model");
const PayrollPayment = require("../modules/payrollPayment.model");
const {
  getMinutesInTimeZone,
  shiftDurationMinutes,
  toMinutesFromHHMM,
} = require("../utils/shift.utils");

const roundMoney = (num) => Math.round((num + Number.EPSILON) * 100) / 100;

const getWeekdayFromDateString = (dateStr) => {
  const [yy, mm, dd] = String(dateStr).split("-").map(Number);
  if (!yy || !mm || !dd) return null;
  const dt = new Date(Date.UTC(yy, mm - 1, dd));
  return dt.getUTCDay();
};

const countWorkingDaysAndDates = (year, month, workDaysSet) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const workingDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(
      2,
      "0",
    )}`;
    const weekday = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (workDaysSet.has(weekday)) {
      workingDates.push(date);
    }
  }
  return { daysInMonth, workingDates };
};

const previousYearMonth = (year, month) => {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
};

const resolveOrgId = (req, paramOrgId) =>
  req.role === "SUPER_ADMIN" ? paramOrgId : req.organizationId;

const buildEmployeeMonthlyCalculation = (
  employee,
  employeeAttendances,
  year,
  month,
  carryFromPrevious = 0,
) => {
  const salary = Number(employee.salary || 0);
  const shiftMinutes = shiftDurationMinutes(employee.department);

  const workDays = Array.isArray(employee.department?.workDays)
    ? employee.department.workDays
    : [1, 2, 3, 4, 5, 6];
  const workDaysSet = new Set(workDays);
  const { daysInMonth, workingDates } = countWorkingDaysAndDates(
    year,
    month,
    workDaysSet,
  );

  const workingDaysInMonth = workingDates.length;
  const minuteRate =
    shiftMinutes > 0 && workingDaysInMonth > 0
      ? salary / (workingDaysInMonth * shiftMinutes)
      : 0;

  const attendanceByDate = {};
  employeeAttendances.forEach((r) => {
    attendanceByDate[r.date] = r;
  });

  const lateDates = [];
  const earlyLeaveDates = [];
  const absentDates = [];

  let totalWorkedMinutes = 0;
  let totalLateMinutes = 0;
  let totalEarlyLeaveMinutes = 0;

  const checkInMins =
    toMinutesFromHHMM(employee.department?.checkInTime) +
    Number(employee.department?.lateAfterMinutes || 0);
  const checkOutMins =
    toMinutesFromHHMM(employee.department?.checkOutTime) -
    Number(employee.department?.earlyLeaveMinutes || 0);

  workingDates.forEach((dateStr) => {
    const r = attendanceByDate[dateStr];
    if (!r) {
      absentDates.push(dateStr);
      return;
    }

    const worked = Math.floor((r.totalHours || 0) * 60);
    totalWorkedMinutes += worked;

    const entryMins = getMinutesInTimeZone(r.firstEntry);
    if (entryMins !== null && entryMins > checkInMins) {
      const minutes = entryMins - checkInMins;
      totalLateMinutes += minutes;
      lateDates.push({ date: dateStr, minutes });
    }

    const exitMins = getMinutesInTimeZone(r.lastExit);
    if (exitMins !== null && checkOutMins > 0 && exitMins < checkOutMins) {
      const minutes = checkOutMins - exitMins;
      totalEarlyLeaveMinutes += minutes;
      earlyLeaveDates.push({ date: dateStr, minutes });
    }
  });

  const presentDays = workingDaysInMonth - absentDates.length;
  const absentDays = absentDates.length;

  const useLatePenalty = Boolean(employee.department?.useLatePenalty);
  const useEarlyLeavePenalty = Boolean(employee.department?.useEarlyLeavePenalty);
  const latePenaltyPerMinute = Number(employee.department?.latePenaltyPerMinute || 0);
  const earlyLeavePenaltyPerMinute = Number(
    employee.department?.earlyLeavePenaltyPerMinute || 0,
  );
  const useTimePenalty = Boolean(employee.department?.useTimePenalty);
  const penaltyPerMinute = Number(employee.department?.penaltyPerMinute || 0);

  const lateByRate = totalLateMinutes * minuteRate;
  const earlyByRate = totalEarlyLeaveMinutes * minuteRate;
  const absenceDeduction = absentDays * shiftMinutes * minuteRate;

  const lateBySeparatePenalty = useLatePenalty
    ? totalLateMinutes * latePenaltyPerMinute
    : lateByRate;
  const earlyBySeparatePenalty = useEarlyLeavePenalty
    ? totalEarlyLeaveMinutes * earlyLeavePenaltyPerMinute
    : earlyByRate;

  const lateDeduction = useTimePenalty
    ? totalLateMinutes * penaltyPerMinute
    : lateBySeparatePenalty;
  const earlyLeaveDeduction = useTimePenalty
    ? totalEarlyLeaveMinutes * penaltyPerMinute
    : earlyBySeparatePenalty;

  const totalDeduction = lateDeduction + earlyLeaveDeduction + absenceDeduction;
  const netSalary = Math.max(salary - totalDeduction, 0);
  const totalDue = netSalary + Number(carryFromPrevious || 0);

  return {
    baseSalary: roundMoney(salary),
    daysInMonth,
    workingDaysInMonth,
    presentDays,
    absentDays,
    shiftMinutesPerDay: shiftMinutes,
    totalWorkedMinutes,
    totalLateMinutes,
    totalEarlyLeaveMinutes,
    lateDates,
    earlyLeaveDates,
    absentDates,
    deductions: {
      policy: {
        useLatePenalty,
        useEarlyLeavePenalty,
        useTimePenalty,
        latePenaltyPerMinute: roundMoney(latePenaltyPerMinute),
        earlyLeavePenaltyPerMinute: roundMoney(earlyLeavePenaltyPerMinute),
        penaltyPerMinute: roundMoney(penaltyPerMinute),
      },
      minuteRate: roundMoney(minuteRate),
      lateDeduction: roundMoney(lateDeduction),
      earlyLeaveDeduction: roundMoney(earlyLeaveDeduction),
      absenceDeduction: roundMoney(absenceDeduction),
      totalDeduction: roundMoney(totalDeduction),
    },
    netSalary: roundMoney(netSalary),
    carryFromPrevious: roundMoney(Number(carryFromPrevious || 0)),
    totalDue: roundMoney(totalDue),
  };
};

const pickYearMonth = (query) => {
  const y = Number(query.year);
  const m = Number(query.month);
  if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) {
    return null;
  }
  return { year: y, month: m };
};

exports.getMonthlyPayroll = async (req, res) => {
  try {
    const ym = pickYearMonth(req.query);
    if (!ym) {
      return res.status(400).json({
        success: false,
        message: "year va month majburiy (month: 1..12)",
      });
    }

    const finalOrganizationId = resolveOrgId(req, req.params.organizationId);
    const { year, month } = ym;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;
    const prev = previousYearMonth(year, month);

    const [employees, attendances, records, prevRecords] = await Promise.all([
      Employee.find({
        organizationId: finalOrganizationId,
      }).populate("department"),
      Attendance.find({
        organizationId: finalOrganizationId,
        date: { $gte: monthStart, $lte: monthEnd },
      }),
      PayrollRecord.find({
        organizationId: finalOrganizationId,
        year,
        month,
      }),
      PayrollRecord.find({
        organizationId: finalOrganizationId,
        year: prev.year,
        month: prev.month,
      }),
    ]);

    const attendanceByEmp = {};
    attendances.forEach((r) => {
      const key = r.employee.toString();
      if (!attendanceByEmp[key]) attendanceByEmp[key] = [];
      attendanceByEmp[key].push(r);
    });

    const recordByEmp = {};
    records.forEach((r) => {
      recordByEmp[r.employee.toString()] = r;
    });

    const prevByEmp = {};
    prevRecords.forEach((r) => {
      prevByEmp[r.employee.toString()] = r;
    });

    const payroll = employees.map((emp) => {
      const empKey = emp._id.toString();
      const carryFromPrevious = Number(prevByEmp[empKey]?.remainingAmount || 0);
      const calc = buildEmployeeMonthlyCalculation(
        emp,
        attendanceByEmp[empKey] || [],
        year,
        month,
        carryFromPrevious,
      );

      const saved = recordByEmp[empKey];
      const merged = saved
        ? {
            ...calc,
            ...{
              baseSalary: saved.baseSalary,
              workingDaysInMonth: saved.workingDaysInMonth,
              presentDays: saved.presentDays,
              absentDays: saved.absentDays,
              totalWorkedMinutes: saved.totalWorkedMinutes,
              totalLateMinutes: saved.totalLateMinutes,
              totalEarlyLeaveMinutes: saved.totalEarlyLeaveMinutes,
              lateDates: saved.lateDates || [],
              earlyLeaveDates: saved.earlyLeaveDates || [],
              absentDates: saved.absentDates || [],
              deductions: saved.deductions,
              netSalary: saved.netSalary,
              carryFromPrevious: saved.carryFromPrevious,
              totalDue: saved.totalDue,
              paidAmount: saved.paidAmount,
              remainingAmount: saved.remainingAmount,
              status: saved.status,
              approvedAt: saved.approvedAt,
              approvedBy: saved.approvedBy,
            },
          }
        : {
            ...calc,
            paidAmount: 0,
            remainingAmount: calc.totalDue,
            status: "DRAFT",
            approvedAt: null,
            approvedBy: null,
          };

      return {
        employee: {
          _id: emp._id,
          fullName: emp.fullName,
          employeeCode: emp.employeeCode,
          department: emp.department?.name || null,
        },
        ...merged,
      };
    });

    return res.json({
      success: true,
      data: {
        organizationId: finalOrganizationId,
        period: `${year}-${String(month).padStart(2, "0")}`,
        payroll,
      },
    });
  } catch (error) {
    console.error("MONTHLY PAYROLL ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.approveEmployeePayroll = async (req, res) => {
  try {
    const ym = pickYearMonth(req.query);
    const { organizationId, employeeId } = req.params;

    if (!ym) {
      return res.status(400).json({
        success: false,
        message: "year va month majburiy (month: 1..12)",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "employeeId noto'g'ri",
      });
    }

    const finalOrganizationId = resolveOrgId(req, organizationId);
    const { year, month } = ym;
    const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;
    const prev = previousYearMonth(year, month);

    const [employee, attendances, prevRecord] = await Promise.all([
      Employee.findOne({
        _id: employeeId,
        organizationId: finalOrganizationId,
      }).populate("department"),
      Attendance.find({
        organizationId: finalOrganizationId,
        employee: employeeId,
        date: { $gte: monthStart, $lte: monthEnd },
      }),
      PayrollRecord.findOne({
        organizationId: finalOrganizationId,
        employee: employeeId,
        year: prev.year,
        month: prev.month,
      }),
    ]);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee topilmadi",
      });
    }

    const carryFromPrevious = Number(prevRecord?.remainingAmount || 0);
    const calc = buildEmployeeMonthlyCalculation(
      employee,
      attendances,
      year,
      month,
      carryFromPrevious,
    );

    const update = {
      organizationId: finalOrganizationId,
      employee: employee._id,
      year,
      month,
      baseSalary: calc.baseSalary,
      workingDaysInMonth: calc.workingDaysInMonth,
      presentDays: calc.presentDays,
      absentDays: calc.absentDays,
      totalWorkedMinutes: calc.totalWorkedMinutes,
      totalLateMinutes: calc.totalLateMinutes,
      totalEarlyLeaveMinutes: calc.totalEarlyLeaveMinutes,
      lateDates: calc.lateDates,
      earlyLeaveDates: calc.earlyLeaveDates,
      absentDates: calc.absentDates,
      deductions: calc.deductions,
      netSalary: calc.netSalary,
      carryFromPrevious: calc.carryFromPrevious,
      totalDue: calc.totalDue,
      paidAmount: 0,
      remainingAmount: calc.totalDue,
      status: "APPROVED",
      approvedBy: req.adminId,
      approvedAt: new Date(),
      lastCalculatedAt: new Date(),
    };

    const record = await PayrollRecord.findOneAndUpdate(
      {
        organizationId: finalOrganizationId,
        employee: employee._id,
        year,
        month,
      },
      update,
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.json({
      success: true,
      message: "Payroll tasdiqlandi",
      data: record,
    });
  } catch (error) {
    console.error("APPROVE PAYROLL ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.addEmployeePayment = async (req, res) => {
  try {
    const ym = pickYearMonth(req.query);
    const { organizationId, employeeId } = req.params;
    const body = req.body || {};
    const { amount, type, note, paymentDate } = body;

    if (!ym) {
      return res.status(400).json({
        success: false,
        message: "year va month majburiy (month: 1..12)",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "employeeId noto'g'ri",
      });
    }
    if (Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "amount majburiy va 0 dan katta bo'lishi kerak",
      });
    }

    if (
      paymentDate !== undefined &&
      Number.isNaN(new Date(paymentDate).getTime())
    ) {
      return res.status(400).json({
        success: false,
        message: "paymentDate noto'g'ri formatda",
      });
    }

    const finalOrganizationId = resolveOrgId(req, organizationId);
    const { year, month } = ym;

    let record = await PayrollRecord.findOne({
      organizationId: finalOrganizationId,
      employee: employeeId,
      year,
      month,
    });

    if (!record) {
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-31`;
      const prev = previousYearMonth(year, month);

      const [employee, attendances, prevRecord] = await Promise.all([
        Employee.findOne({
          _id: employeeId,
          organizationId: finalOrganizationId,
        }).populate("department"),
        Attendance.find({
          organizationId: finalOrganizationId,
          employee: employeeId,
          date: { $gte: monthStart, $lte: monthEnd },
        }),
        PayrollRecord.findOne({
          organizationId: finalOrganizationId,
          employee: employeeId,
          year: prev.year,
          month: prev.month,
        }),
      ]);

      if (!employee) {
        return res.status(404).json({
          success: false,
          message: "Employee topilmadi",
        });
      }

      const carryFromPrevious = Number(prevRecord?.remainingAmount || 0);
      const calc = buildEmployeeMonthlyCalculation(
        employee,
        attendances,
        year,
        month,
        carryFromPrevious,
      );

      record = await PayrollRecord.findOneAndUpdate(
        {
          organizationId: finalOrganizationId,
          employee: employeeId,
          year,
          month,
        },
        {
          organizationId: finalOrganizationId,
          employee: employeeId,
          year,
          month,
          baseSalary: calc.baseSalary,
          workingDaysInMonth: calc.workingDaysInMonth,
          presentDays: calc.presentDays,
          absentDays: calc.absentDays,
          totalWorkedMinutes: calc.totalWorkedMinutes,
          totalLateMinutes: calc.totalLateMinutes,
          totalEarlyLeaveMinutes: calc.totalEarlyLeaveMinutes,
          lateDates: calc.lateDates,
          earlyLeaveDates: calc.earlyLeaveDates,
          absentDates: calc.absentDates,
          deductions: calc.deductions,
          netSalary: calc.netSalary,
          carryFromPrevious: calc.carryFromPrevious,
          totalDue: calc.totalDue,
          paidAmount: 0,
          // To'lov limiti tasdiqsiz rejimda baseSalary bilan cheklanadi.
          remainingAmount: calc.baseSalary,
          status: "DRAFT",
          approvedBy: null,
          approvedAt: null,
          lastCalculatedAt: new Date(),
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        },
      );
    }

    const payAmount = Number(amount);
    const maxPayable = Number(record.baseSalary || 0);
    const alreadyPaid = Number(record.paidAmount || 0);
    const availableToPay = Math.max(maxPayable - alreadyPaid, 0);

    if (payAmount > availableToPay) {
      return res.status(400).json({
        success: false,
        message:
          "To'lov summasi oylik limitidan katta bo'lishi mumkin emas",
      });
    }

    if (availableToPay <= 0) {
      return res.status(400).json({
        success: false,
        message: "Bu oy uchun oylik limiti to'liq yopilgan",
      });
    }

    const payment = await PayrollPayment.create({
      organizationId: finalOrganizationId,
      employee: employeeId,
      payrollRecord: record._id,
      year,
      month,
      amount: payAmount,
      type: type || "PARTIAL",
      note: note || "",
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      createdBy: req.adminId,
    });

    const newPaidAmount = roundMoney(alreadyPaid + payAmount);
    const newRemaining = roundMoney(maxPayable - newPaidAmount);

    record.paidAmount = newPaidAmount;
    record.remainingAmount = Math.max(newRemaining, 0);
    if (record.remainingAmount === 0) {
      record.status = "PAID";
    } else if (record.paidAmount > 0) {
      record.status = "PARTIAL_PAID";
    } else {
      record.status = "DRAFT";
    }
    await record.save();

    return res.json({
      success: true,
      message: "To'lov qo'shildi",
      data: {
        payment,
        payroll: record,
      },
    });
  } catch (error) {
    console.error("ADD PAYROLL PAYMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getEmployeePayrollLedger = async (req, res) => {
  try {
    const ym = pickYearMonth(req.query);
    const { organizationId, employeeId } = req.params;

    if (!ym) {
      return res.status(400).json({
        success: false,
        message: "year va month majburiy (month: 1..12)",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return res.status(400).json({
        success: false,
        message: "employeeId noto'g'ri",
      });
    }

    const finalOrganizationId = resolveOrgId(req, organizationId);
    const { year, month } = ym;

    const record = await PayrollRecord.findOne({
      organizationId: finalOrganizationId,
      employee: employeeId,
      year,
      month,
    }).populate("employee", "fullName employeeCode");

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Bu oy uchun payroll record topilmadi",
      });
    }

    const payments = await PayrollPayment.find({
      payrollRecord: record._id,
    }).sort({ paymentDate: 1, createdAt: 1 });

    return res.json({
      success: true,
      data: {
        payroll: record,
        payments,
      },
    });
  } catch (error) {
    console.error("GET PAYROLL LEDGER ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
