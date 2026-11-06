/**
 * Native iOS Shortcuts ingestion only. Does not expose health data via GET.
 * Disabled by default. Secrets belong in Script Properties, never in this file or the PWA.
 * All health writes use one Script Lock. The PWA remains read-only for these tables.
 */
var HEALTH_HEADERS = {
  HealthMetrics: [
    "id",
    "sampleKey",
    "measuredAt",
    "date",
    "timezone",
    "metricType",
    "value",
    "unit",
    "source",
    "deviceId",
    "updatedAt",
    "deletedAt",
  ],
  DailySteps: [
    "id",
    "date",
    "timezone",
    "totalSteps",
    "source",
    "deviceId",
    "revision",
    "updatedAt",
  ],
  WorkoutLogs: [
    "id",
    "date",
    "timezone",
    "type",
    "minutes",
    "calories",
    "note",
    "source",
    "revision",
    "updatedAt",
    "deletedAt",
  ],
  WorkoutPlans: [
    // Header compatibility only; health ingestion never seeds or modifies weekly plans.
    "id",
    "weekday",
    "type",
    "title",
    "minMinutes",
    "maxMinutes",
    "tutorialUrl",
    "active",
    "updatedAt",
  ],
  SyncLogs: [
    "requestId",
    "deviceId",
    "receivedAt",
    "rangeStart",
    "rangeEnd",
    "status",
    "acceptedCount",
    "rejectedCount",
    "errorCode",
  ],
};
// Optional additive tabs (schema version 1). Ingestion never reads or writes them.
var HEALTH_OPTIONAL_TABS = ["TreadmillSegments", "Videos"];
function healthFail(code) {
  var error = new Error(code);
  error.healthCode = code;
  throw error;
}
function healthJson(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
function healthHash(value) {
  return Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    value,
    Utilities.Charset.UTF_8,
  )
    .map(function (b) {
      return ("0" + ((b + 256) % 256).toString(16)).slice(-2);
    })
    .join("");
}
function healthSameDigest(a, b) {
  if (!/^[a-f0-9]{64}$/.test(a || "") || !/^[a-f0-9]{64}$/.test(b || ""))
    return false;
  var difference = 0;
  for (var i = 0; i < 64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
function healthText(value, max) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= max &&
    value.trim().charAt(0) !== "="
  );
}
function healthNumber(value, min, max, integer) {
  return (
    typeof value === "number" &&
    isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Math.floor(value) === value)
  );
}
function healthIso(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    !isFinite(Date.parse(value))
  )
    healthFail("INVALID_TIME");
  if (!healthDay(value.slice(0, 10))) healthFail("INVALID_TIME");
  return new Date(value).toISOString();
}
function healthDay(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    isFinite(Date.parse(value + "T12:00:00Z")) &&
    new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
  );
}
function healthObject(value, fields) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some(function (key) {
      return fields.indexOf(key) < 0;
    })
  )
    healthFail("INVALID_FIELDS");
}
function healthMetricSpec(type, value, unit) {
  var specs = {
    weight: ["kg", 1, 500],
    bodyFat: ["percent", 0, 100],
    heartRate: ["bpm", 20, 250],
  };
  var spec = Object.prototype.hasOwnProperty.call(specs, type)
    ? specs[type]
    : null;
  return (
    !!spec && spec[0] === unit && healthNumber(value, spec[1], spec[2], false)
  );
}
function healthNormalize(input, timezone, deviceId, now) {
  healthObject(input, [
    "version",
    "requestId",
    "deviceId",
    "token",
    "rangeStart",
    "rangeEnd",
    "metrics",
    "dailySteps",
  ]);
  if (
    input.version !== 1 ||
    !/^[a-zA-Z0-9_-]{16,64}$/.test(input.requestId || "") ||
    input.deviceId !== deviceId
  )
    healthFail("INVALID_REQUEST");
  if (
    !Array.isArray(input.metrics) ||
    !Array.isArray(input.dailySteps) ||
    input.metrics.length + input.dailySteps.length < 1 ||
    input.metrics.length + input.dailySteps.length > 200
  )
    healthFail("INVALID_BATCH");
  var start = healthIso(input.rangeStart),
    end = healthIso(input.rangeEnd);
  if (
    Date.parse(start) > Date.parse(end) ||
    Date.parse(end) - Date.parse(start) > 31 * 86400000 ||
    Date.parse(end) > now + 300000
  )
    healthFail("INVALID_RANGE");
  var startDay = Utilities.formatDate(new Date(start), timezone, "yyyy-MM-dd");
  var endDay = Utilities.formatDate(new Date(end), timezone, "yyyy-MM-dd");
  var metrics = input.metrics
    .map(function (m) {
      healthObject(m, [
        "sampleKey",
        "measuredAt",
        "metricType",
        "value",
        "unit",
        "source",
      ]);
      if (
        !healthText(m.sampleKey, 500) ||
        !healthText(m.source, 200) ||
        !healthMetricSpec(m.metricType, m.value, m.unit)
      )
        healthFail("INVALID_METRIC");
      var time = healthIso(m.measuredAt);
      if (
        Date.parse(time) < Date.parse(start) ||
        Date.parse(time) > Date.parse(end)
      )
        healthFail("OUTSIDE_RANGE");
      return {
        sampleKey: deviceId + ":" + m.sampleKey,
        measuredAt: time,
        date: Utilities.formatDate(new Date(time), timezone, "yyyy-MM-dd"),
        metricType: m.metricType,
        value: m.value,
        unit: m.unit,
        source: m.source,
      };
    })
    .sort(function (a, b) {
      return a.sampleKey.localeCompare(b.sampleKey);
    });
  var steps = input.dailySteps
    .map(function (s) {
      healthObject(s, ["date", "totalSteps", "computedAt", "source"]);
      if (
        !healthDay(s.date) ||
        !healthNumber(s.totalSteps, 0, 200000, true) ||
        !healthText(s.source, 200) ||
        s.date < startDay ||
        s.date > endDay
      )
        healthFail("INVALID_STEPS");
      var time = healthIso(s.computedAt);
      if (
        Date.parse(time) > now + 300000 ||
        s.date > Utilities.formatDate(new Date(time), timezone, "yyyy-MM-dd")
      )
        healthFail("INVALID_TIME");
      return {
        date: s.date,
        totalSteps: s.totalSteps,
        computedAt: time,
        source: s.source,
      };
    })
    .sort(function (a, b) {
      return (
        a.date.localeCompare(b.date) || a.computedAt.localeCompare(b.computedAt)
      );
    });
  return {
    version: 1,
    requestId: input.requestId,
    deviceId: deviceId,
    rangeStart: start,
    rangeEnd: end,
    metrics: metrics,
    dailySteps: steps,
  };
}
function healthPrivateFile(id) {
  var file = DriveApp.getFileById(id);
  var owner = file.getOwner();
  var effective = Session.getEffectiveUser().getEmail();
  var ownerEmail = owner && owner.getEmail().toLowerCase();
  var sharedWithOthers = file
    .getEditors()
    .concat(file.getViewers())
    .some(function (user) {
      return user.getEmail().toLowerCase() !== ownerEmail;
    });
  if (
    !ownerEmail ||
    !effective ||
    ownerEmail !== effective.toLowerCase() ||
    file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
    sharedWithOthers
  )
    healthFail("PRIVATE_OWNER_REQUIRED");
}
function healthContext(id) {
  healthPrivateFile(id);
  var ss = SpreadsheetApp.openById(id),
    sheets = ss.getSheets(),
    tabs = {};
  var names = sheets.map(function (sheet) {
    return sheet.getName();
  });
  if (
    names.some(function (name, i) {
      return (
        names.indexOf(name) !== i ||
        (!HEALTH_HEADERS.hasOwnProperty(name) &&
          HEALTH_OPTIONAL_TABS.indexOf(name) < 0)
      );
    })
  )
    healthFail("SCHEMA_MISMATCH");
  var version = ss.getDeveloperMetadata().filter(function (m) {
    return (
      m.getKey() === "fitnessSchemaVersion" &&
      m.getValue() === "1" &&
      String(m.getVisibility()) === "DOCUMENT" &&
      String(m.getLocation().getLocationType()) === "SPREADSHEET"
    );
  });
  if (version.length !== 1) healthFail("SCHEMA_MISMATCH");
  Object.keys(HEALTH_HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name),
      headers = HEALTH_HEADERS[name];
    if (
      !sheet ||
      sheet.getMaxColumns() !== headers.length ||
      sheet.getMaxRows() > 5001 ||
      JSON.stringify(sheet.getRange(1, 1, 1, headers.length).getValues()[0]) !==
        JSON.stringify(headers)
    )
      healthFail("SCHEMA_MISMATCH");
    tabs[name] = sheet;
  });
  return { ss: ss, tabs: tabs, timezone: ss.getSpreadsheetTimeZone() };
}
function healthRows(sheet, columns) {
  var last = sheet.getLastRow();
  if (last <= 1) return [];
  if (last > 5001) healthFail("ROW_LIMIT");
  var range = sheet.getRange(2, 1, last - 1, columns);
  if (
    range.getFormulas().some(function (row) {
      return row.some(function (v) {
        return !!v;
      });
    })
  )
    healthFail("FORMULA_NOT_ALLOWED");
  return range.getValues();
}
/** Pure merge plan. Re-sending never adds yesterday's total onto today's snapshot. */
function healthPlan(
  existingMetrics,
  existingSteps,
  batch,
  timezone,
  updatedAt,
) {
  var metrics = existingMetrics.map(function (row) {
    return row.slice();
  });
  var steps = existingSteps.map(function (row) {
    return row.slice();
  });
  var bySample = Object.create(null),
    byDate = Object.create(null),
    sampleIds = Object.create(null),
    stepIds = Object.create(null);
  var added = 0,
    changed = 0,
    duplicates = 0,
    stale = 0;
  function present(row) {
    return row.some(function (v) {
      return v !== "" && v !== null;
    });
  }
  metrics.forEach(function (row, i) {
    if (!present(row)) return;
    if (
      !healthText(row[0], 2000) ||
      !healthText(row[1], 2000) ||
      Object.prototype.hasOwnProperty.call(bySample, row[1]) ||
      sampleIds[row[0]] ||
      row[4] !== timezone ||
      !healthMetricSpec(row[5], row[6], row[7]) ||
      !healthDay(row[3]) ||
      !healthText(row[8], 200) ||
      !healthText(row[9], 200)
    )
      healthFail("EXISTING_DATA_INVALID");
    healthIso(row[2]);
    healthIso(row[10]);
    if (row[11]) healthIso(row[11]);
    if (
      Utilities.formatDate(new Date(row[2]), timezone, "yyyy-MM-dd") !== row[3]
    )
      healthFail("EXISTING_DATA_INVALID");
    bySample[row[1]] = i;
    sampleIds[row[0]] = true;
  });
  steps.forEach(function (row, i) {
    if (!present(row)) return;
    if (
      !healthText(row[0], 2000) ||
      !healthDay(row[1]) ||
      Object.prototype.hasOwnProperty.call(byDate, row[1]) ||
      stepIds[row[0]] ||
      row[2] !== timezone ||
      !healthNumber(row[3], 0, 200000, true) ||
      !healthNumber(row[6], 1, 9007199254740000, true) ||
      !healthText(row[4], 200) ||
      !healthText(row[5], 200)
    )
      healthFail("EXISTING_DATA_INVALID");
    healthIso(row[7]);
    byDate[row[1]] = i;
    stepIds[row[0]] = true;
  });
  batch.metrics.forEach(function (m) {
    var row = [
      healthHash(m.sampleKey),
      m.sampleKey,
      m.measuredAt,
      m.date,
      timezone,
      m.metricType,
      m.value,
      m.unit,
      m.source,
      batch.deviceId,
      updatedAt,
      "",
    ];
    if (Object.prototype.hasOwnProperty.call(bySample, m.sampleKey)) {
      var old = metrics[bySample[m.sampleKey]];
      // updatedAt and tombstone may differ; a replay must never resurrect a deleted sample.
      for (var i = 1; i <= 9; i++)
        if (old[i] !== row[i]) healthFail("SAMPLE_CONFLICT");
      duplicates++;
    } else {
      bySample[m.sampleKey] = metrics.length;
      metrics.push(row);
      added++;
    }
  });
  batch.dailySteps.forEach(function (s) {
    var index = Object.prototype.hasOwnProperty.call(byDate, s.date)
      ? byDate[s.date]
      : -1;
    var old = index >= 0 ? steps[index] : null;
    if (old) {
      var difference = Date.parse(s.computedAt) - Date.parse(old[7]);
      if (difference < 0) {
        stale++;
        return;
      }
      if (difference === 0) {
        if (
          old[3] !== s.totalSteps ||
          old[4] !== s.source ||
          old[5] !== batch.deviceId
        )
          healthFail("STEPS_CONFLICT");
        duplicates++;
        return;
      }
    }
    var row = [
      old ? old[0] : healthHash(timezone + ":" + s.date),
      s.date,
      timezone,
      s.totalSteps,
      s.source,
      batch.deviceId,
      old ? old[6] + 1 : 1,
      s.computedAt,
    ];
    if (old) steps[index] = row;
    else {
      byDate[s.date] = steps.length;
      steps.push(row);
    }
    changed++;
  });
  if (metrics.length > 5000 || steps.length > 5000) healthFail("ROW_LIMIT");
  return {
    metrics: metrics,
    steps: steps,
    added: added,
    changed: changed,
    duplicates: duplicates,
    stale: stale,
  };
}
function healthWrite(sheet, row, values) {
  var required = row + values.length - 1;
  if (required > 5001) healthFail("ROW_LIMIT");
  if (sheet.getMaxRows() < required)
    sheet.insertRowsAfter(sheet.getMaxRows(), required - sheet.getMaxRows());
  sheet.getRange(row, 1, values.length, values[0].length).setValues(values);
}
function healthRememberRequest(properties, requestId, digest) {
  var history = JSON.parse(
    properties.getProperty("HEALTH_REQUEST_HISTORY") || "[]",
  );
  if (!Array.isArray(history)) healthFail("CONFIG_INVALID");
  var key = "HEALTH_REQUEST_" + requestId;
  properties.setProperty(key, digest);
  history = history.filter(function (id) {
    return id !== requestId;
  });
  history.push(requestId);
  while (history.length > 50)
    properties.deleteProperty("HEALTH_REQUEST_" + history.shift());
  properties.setProperty("HEALTH_REQUEST_HISTORY", JSON.stringify(history));
}
function doGet() {
  return healthJson({ ok: false, error: "METHOD_NOT_ALLOWED" });
}
function doPost(event) {
  var lock = null,
    locked = false;
  try {
    var properties = PropertiesService.getScriptProperties();
    if (properties.getProperty("HEALTH_INGEST_ENABLED") !== "true")
      healthFail("SERVICE_DISABLED");
    var body = event && event.postData && event.postData.contents;
    if (
      typeof body !== "string" ||
      body.length > 262144 ||
      Utilities.newBlob(body).getBytes().length > 262144
    )
      healthFail("INVALID_BODY");
    var input;
    try {
      input = JSON.parse(body);
    } catch (e) {
      healthFail("INVALID_JSON");
    }
    if (
      !input ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      !healthText(input.token, 256) ||
      !healthSameDigest(
        properties.getProperty("HEALTH_DEVICE_TOKEN_SHA256"),
        healthHash(input.token),
      ) ||
      input.deviceId !== properties.getProperty("HEALTH_DEVICE_ID")
    )
      healthFail("AUTH_FAILED");
    // No file access occurs before per-device authentication.
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) healthFail("BUSY_RETRY");
    locked = true;
    var id = properties.getProperty("HEALTH_SPREADSHEET_ID");
    if (!id) healthFail("CONFIG_INVALID");
    var context = healthContext(id),
      now = new Date().toISOString();
    var batch = healthNormalize(
      input,
      context.timezone,
      properties.getProperty("HEALTH_DEVICE_ID"),
      Date.now(),
    );
    var digest = healthHash(id + ":" + JSON.stringify(batch));
    var logs = healthRows(context.tabs.SyncLogs, 9);
    var logIndex = -1;
    logs.forEach(function (row, i) {
      if (row[0] === batch.requestId) {
        if (logIndex >= 0) healthFail("EXISTING_DATA_INVALID");
        logIndex = i;
      }
    });
    var remembered = properties.getProperty(
      "HEALTH_REQUEST_" + batch.requestId,
    );
    if (remembered && !healthSameDigest(remembered, digest))
      healthFail("REQUEST_ID_REUSED");
    if (logIndex >= 0 && !remembered) healthFail("REQUEST_EXPIRED");
    if (logIndex >= 0 && logs[logIndex][1] !== batch.deviceId)
      healthFail("AUTH_FAILED");
    if (logIndex >= 0 && logs[logIndex][5] === "committed")
      return healthJson({
        ok: true,
        requestId: batch.requestId,
        acceptedCount: logs[logIndex][6],
        replayed: true,
      });
    var plan = healthPlan(
      healthRows(context.tabs.HealthMetrics, 12),
      healthRows(context.tabs.DailySteps, 8),
      batch,
      context.timezone,
      now,
    );
    if (logIndex < 0) {
      if (logs.length >= 5000) healthFail("ROW_LIMIT");
      logIndex = logs.length;
    }
    healthRememberRequest(properties, batch.requestId, digest);
    var log = [
      batch.requestId,
      batch.deviceId,
      now,
      batch.rangeStart,
      batch.rangeEnd,
      "partial",
      0,
      0,
      "IN_PROGRESS",
    ];
    healthWrite(context.tabs.SyncLogs, logIndex + 2, [log]);
    // Sheets has no multi-table transaction here. A partial failure stays partial and is safe to retry.
    if (plan.added) healthWrite(context.tabs.HealthMetrics, 2, plan.metrics);
    if (plan.changed) healthWrite(context.tabs.DailySteps, 2, plan.steps);
    SpreadsheetApp.flush();
    log[5] = "committed";
    log[6] = batch.metrics.length + batch.dailySteps.length;
    log[8] = "";
    healthWrite(context.tabs.SyncLogs, logIndex + 2, [log]);
    SpreadsheetApp.flush();
    return healthJson({
      ok: true,
      requestId: batch.requestId,
      acceptedCount: log[6],
      writtenCount: plan.added + plan.changed,
      duplicates: plan.duplicates,
      staleSteps: plan.stale,
    });
  } catch (error) {
    return healthJson({ ok: false, error: error.healthCode || "SYNC_FAILED" });
  } finally {
    if (locked) lock.releaseLock();
  }
}
/** Run once after setting HEALTH_SPREADSHEET_ID. Never logs the device token. */
function initializeHealthIngest() {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("HEALTH_DEVICE_TOKEN_SHA256"))
    throw new Error("裝置憑證已存在，未進行輪替。");
  var id = properties.getProperty("HEALTH_SPREADSHEET_ID");
  if (!id) throw new Error("請先在指令碼屬性設定 HEALTH_SPREADSHEET_ID");
  healthContext(id);
  var token =
    Utilities.getUuid().replace(/-/g, "") +
    Utilities.getUuid().replace(/-/g, "");
  properties.setProperties({
    HEALTH_DEVICE_ID:
      properties.getProperty("HEALTH_DEVICE_ID") ||
      "iphone-" + Utilities.getUuid(),
    HEALTH_DEVICE_TOKEN_SHA256: healthHash(token),
    HEALTH_DEVICE_TOKEN_ONCE: token,
    HEALTH_INGEST_ENABLED: "false",
  });
  Logger.log(
    "初始化完成，服務仍關閉。請到指令碼屬性複製裝置 ID 與 HEALTH_DEVICE_TOKEN_ONCE 到自己的捷徑，複製後刪除 HEALTH_DEVICE_TOKEN_ONCE。不要分享含憑證的捷徑。",
  );
}
