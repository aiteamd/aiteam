/**
 * 제품 관리 시스템 - 서버 사이드 스크립트 (최적화 버전)
 * 마지막 업데이트: 2025-03-10
 * 
 * 주요 기능:
 * - 웹 애플리케이션 배포 및 초기화
 * - 스프레드시트 데이터 CRUD 작업
 * - 필드 정의 및 메타데이터 관리
 */

// =============== 상수 및 설정 ===============

// 공유 드라이브 직접 접근 시도
function testSharedDriveAccess() {
  try {
    const sharedDrive = DriveApp.getFolderById(SHARED_DRIVE_ID);
    Logger.log("공유 드라이브 이름: " + sharedDrive.getName());
    return true;
  } catch (e) {
    Logger.log("오류 발생: " + e.toString());
    return false;
  }
}

/**
 * 공유 드라이브 ID 상수 (이 ID를 실제 사용할 공유 드라이브 ID로 변경)
 * @constant {string}
 */
const SHARED_DRIVE_ID = '0AP4rjjy8X6rYUk9PVA';

/**
 * 권한 관리 상수 - 기본 관리자 이메일 목록
 * @constant {Array}
 */
const DEFAULT_ADMIN_EMAILS = [
  'kis@grunamu.com',
  'ssw@grunamu.com',
  'sjy@grunamu.com'
];

/**
 * 시스템에서 사용하는 시트 이름 상수
 * @constant {Object}
 */
const SHEET_NAMES = {
  PRODUCT_DATA: 'Master',
  FIELD_DEFINITIONS: 'FieldDefinitions',
  FIELD_GROUPS: 'FieldGroups',
  ACCESSORIES_MASTER: '부자재 마스터', // 부자재 마스터 시트 추가
  ACCESSORIES_DATA: '부자재 정보', // 부자재 정보 시트
  CHANGE_HISTORY: 'ChangeHistory', // 변경 히스토리 시트 추가
  DOCUMENT_INFO: '서류 정보' // 서류 정보 시트 추가
};

/**
 * 시스템 오류 메시지 상수
 * @constant {Object}
 */
const ERROR_MESSAGES = {
  NO_ACTIVE_SPREADSHEET: '활성 스프레드시트를 가져올 수 없습니다. 권한을 확인하세요.',
  NO_SHEETS: '스프레드시트에 사용 가능한 시트가 없습니다.',
  NO_DATA: '스프레드시트에 데이터가 없습니다. 데이터를 추가해주세요.',
  INVALID_ROW_INDEX: '잘못된 행 인덱스입니다: ',
  ROW_NOT_FOUND: '해당 행을 찾을 수 없습니다. 인덱스: ',
  INVALID_PRODUCT_DATA: '제품 데이터가 배열 형식이 아닙니다.',
  SABANGNET_CODE_NOT_FOUND: '해당 사방넷 코드를 가진 제품을 찾을 수 없습니다.',
  SABANGNET_COLUMN_NOT_FOUND: '사방넷 코드 열을 찾을 수 없습니다.',
  FIELD_NOT_FOUND: '해당 필드를 찾을 수 없습니다: ',
  INVALID_FIELD_DEF_SHEET: '필드 정의 시트 형식이 올바르지 않습니다.',
  INVALID_FIELD_GROUP_SHEET: '그룹 정의 시트 형식이 올바르지 않습니다.'
};

/**
 * 문서 관련 오류 메시지 상수
 * @constant {Object}
 */
const DOCUMENT_ERROR_MESSAGES = {
  NO_DRIVE_ACCESS: '구글 드라이브에 접근할 수 없습니다. 권한을 확인하세요.',
  FOLDER_CREATE_FAILED: '폴더를 생성할 수 없습니다: ',
  FILE_UPLOAD_FAILED: '파일 업로드에 실패했습니다: ',
  NO_FILE_SELECTED: '업로드할 파일을 선택하세요.',
  FILE_DOWNLOAD_FAILED: '파일 다운로드에 실패했습니다: ',
  NO_DOCUMENT_SHEET: '서류 정보 시트를 찾을 수 없습니다.',
  DOCUMENT_TYPE_NOT_FOUND: '문서 유형을 찾을 수 없습니다: ',
  INVALID_SABANG_CODE: '유효하지 않은 사방넷 코드입니다: '
};

/**
 * 기본 필드 그룹 정의
 * @constant {Object}
 */
const DEFAULT_FIELD_GROUPS = {
  '기본 정보': { displayName: '기본 정보', order: 1 },
  '물류 정보': { displayName: '물류 정보', order: 2 },
  '디자인/인증 정보': { displayName: '디자인/인증 정보', order: 3 }
};

/**
 * 기본 문서 유형 정의
 * @constant {Array}
 */
const DEFAULT_DOCUMENT_TYPES = [
  '원료 COA',
  'IFRA 향료',
  'FFC 무향료 확인서',
  'PS 제품규격서',
  'ISO 22716 인증서',
  'MP 제조공정서',
  '완제품 COA',
  '완제품 SDS',
  'ISO21149/16212 미생물검사',
  'ISO11930 보존제 유효성 시험',
  'Stability test 안정성 테스트(3개월)',
  '피부자극 테스트(패치테스트)',
  'CT 용기적합성테스트',
  'CFD 비동물실험 선언서',
  'GMP CMR-Free 선언서',
  '유통기한',
  'PMSR 시판 후 안정성 보고서',
  'RMC 완료 적합성 확인서',
  'PCD 포장 적합성',
  'Package Integrity & Compliance Test - 용기 밀폐성 및 적합성 테스트',
  'AWF 제품 디자인',
  'LCF 라벨링 적합성'
];


// 캐시 유틸리티 (스크립트 프로퍼티와 메모리 캐시 조합)
const CacheUtil = {
  _memoryCache: {},
  
  /**
   * 캐시에서 값 가져오기 (메모리 캐시 -> 스크립트 프로퍼티 순)
   * @param {string} key - 캐시 키
   * @param {*} defaultValue - 기본값
   * @return {*} 캐시된 값 또는 기본값
   */
  get(key, defaultValue) {
    // 1. 메모리 캐시 확인
    if (this._memoryCache[key] !== undefined) {
      return this._memoryCache[key];
    }
    
    // 2. 스크립트 프로퍼티 확인
    try {
      const value = PropertiesService.getScriptProperties().getProperty(key);
      if (value) {
        const parsedValue = JSON.parse(value);
        // 메모리 캐시에 저장
        this._memoryCache[key] = parsedValue;
        return parsedValue;
      }
    } catch (e) {}
    
    return defaultValue;
  },
  
  /**
   * 캐시에 값 저장 (메모리 캐시와 스크립트 프로퍼티 모두)
   * @param {string} key - 캐시 키
   * @param {*} value - 저장할 값
   */
  set(key, value) {
    // 메모리 캐시 업데이트
    this._memoryCache[key] = value;
    
    // 스크립트 프로퍼티 업데이트
    try {
      PropertiesService.getScriptProperties().setProperty(
        key, 
        JSON.stringify(value)
      );
    } catch (e) {}
  },
  
  /**
   * 캐시에서 값 삭제
   * @param {string} key - 캐시 키
   */
  remove(key) {
    // 메모리 캐시에서 삭제
    delete this._memoryCache[key];
    
    // 스크립트 프로퍼티에서 삭제
    try {
      PropertiesService.getScriptProperties().deleteProperty(key);
    } catch (e) {}
  }
};

// =============== 웹 앱 초기화 및 설정 ===============

/**
 * 관리자 이메일 수동 재설정
 * 이 함수는 관리자 이메일을 강제로 재설정합니다.
 * 시스템 접근이 불가능한 경우에만 사용하세요.
 */
function resetAdminEmails() {
  // 여기에 실제 관리자 이메일 입력
  const newAdminEmails = [
    'kis@grunamu.com',
    // 필요시 추가 관리자 이메일을 여기에 추가
  ];
  
  // 메모리 캐시와 스크립트 프로퍼티에 저장
  CacheUtil.set('FIELD_MANAGEMENT_USERS', newAdminEmails);
  
  return createResult(true, '관리자 이메일 재설정 완료', {
    fieldManagementUsers: newAdminEmails
  });
}

/**
 * 사용자 권한 정보 가져오기
 * @return {Object} 권한 정보 객체
 */
function getUserPermissionInfo() {
  try {
    // 현재 사용자 이메일 가져오기
    const currentUserEmail = Session.getActiveUser().getEmail();
    
    // 필드 관리 권한 사용자 목록 가져오기 (캐시 이용)
    const fieldManagementUsers = CacheUtil.get('FIELD_MANAGEMENT_USERS', DEFAULT_ADMIN_EMAILS);
    
    return createResult(true, '', {
      currentUserEmail: currentUserEmail,
      fieldManagementUsers: fieldManagementUsers
    });
  } catch (error) {
    Logger.log("사용자 권한 정보 조회 오류: " + error.toString());
    return createResult(false, "사용자 권한 정보를 가져오는 중 오류가 발생했습니다: " + error.toString());
  }
}

/**
 * 필드 관리 권한 사용자 목록 업데이트
 * @param {Array} userEmails - 사용자 이메일 배열
 * @return {Object} 결과 객체
 */
function updateFieldManagementUsers(userEmails) {
  try {
    // 현재 사용자 이메일 가져오기
    const currentUserEmail = Session.getActiveUser().getEmail();
    
    // 현재 저장된 권한 목록 가져오기
    const currentUsers = CacheUtil.get('FIELD_MANAGEMENT_USERS', DEFAULT_ADMIN_EMAILS);
    
    // 현재 사용자가 관리자인지 확인
    const isAdmin = currentUsers.some(email => 
      email.toLowerCase() === currentUserEmail.toLowerCase()
    );
    
    if (!isAdmin) {
      return createResult(false, "권한 설정을 변경할 권한이 없습니다.");
    }
    
    // 새 관리자 목록에 현재 사용자가 포함되어 있는지 확인
    const currentUserIncluded = userEmails.some(email => 
      email.toLowerCase() === currentUserEmail.toLowerCase()
    );
    
    // 현재 사용자가 목록에서 빠져있다면 추가
    if (!currentUserIncluded) {
      userEmails.push(currentUserEmail);
    }
    
    // 새 목록 저장 (메모리 캐시와 스크립트 프로퍼티)
    CacheUtil.set('FIELD_MANAGEMENT_USERS', userEmails);
    
    return createResult(true, "필드 관리 권한 사용자 목록이 업데이트되었습니다.", {
      fieldManagementUsers: userEmails
    });
  } catch (error) {
    Logger.log("권한 업데이트 오류: " + error.toString());
    return createResult(false, "권한 설정을 업데이트하는 중 오류가 발생했습니다: " + error.toString());
  }
}

/**
 * 웹 앱 배포 함수 - Apps Script 웹 앱의 진입점
 * @param {Object} e - 이벤트 객체
 * @return {HtmlOutput} HTML 출력 객체
 */
function doGet(e) {
  try {
    // 초기화 시도 (오류가 나도 계속 진행)
    try {
      setupInitialData();
    } catch (initError) {
      Logger.log("초기 데이터 설정 중 오류 (무시됨): " + initError.toString());
    }
    
    // HTML 템플릿 생성 및 반환
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('제품 관리 시스템')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (error) {
    Logger.log("doGet 오류: " + error.toString());
    
    // 오류가 발생해도 UI는 반환
    return HtmlService.createHtmlOutput(createErrorHtml(error))
      .setTitle('제품 관리 시스템 - 오류')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
}

/**
 * 오류 발생 시 보여줄 HTML 생성
 * @param {Error} error - 발생한 오류 객체
 * @return {string} HTML 문자열
 */
function createErrorHtml(error) {
  return '<div style="padding: 20px; text-align: center;">' +
    '<h2>제품 관리 시스템</h2>' +
    '<p style="color: red;">시스템을 초기화하는 중 오류가 발생했습니다: ' + error.toString() + '</p>' +
    '<button onclick="window.location.reload()">다시 시도</button>' +
    '</div>';
}

/**
 * HTML 파일 포함 함수
 * @param {string} filename - 포함할 파일명
 * @return {string} HTML 콘텐츠
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// =============== 유틸리티 및 헬퍼 함수 ===============

/**
 * 스프레드시트와 시트 가져오기 - 캐싱 처리 추가
 * @param {string} [sheetName=null] - 가져올 시트 이름 (선택적)
 * @return {Object} 스프레드시트와 시트 객체를 포함한 객체
 * @throws {Error} 스프레드시트나 시트를 가져오지 못할 경우 에러 발생
 */
function getSpreadsheetAndSheet(sheetName = null) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      throw new Error(ERROR_MESSAGES.NO_ACTIVE_SPREADSHEET);
    }
    
    let sheet = null;
    if (sheetName) {
      sheet = ss.getSheetByName(sheetName);
    }
    
    if (!sheet) {
      // 시트 이름이 제공되지 않았거나 시트를 찾을 수 없는 경우 첫 번째 시트 사용
      const sheets = ss.getSheets();
      if (sheets && sheets.length > 0) {
        sheet = sheets[0];
      } else {
        throw new Error(ERROR_MESSAGES.NO_SHEETS);
      }
    }
    
    return { spreadsheet: ss, sheet: sheet };
  } catch (error) {
    Logger.log("스프레드시트 접근 오류: " + error.toString());
    throw error;
  }
}

/**
 * 결과 객체 생성 유틸리티 함수
 * @param {boolean} success - 성공 여부
 * @param {string} message - 메시지
 * @param {Object} [data=null] - 추가 데이터 (선택적)
 * @return {Object} 결과 객체
 */
function createResult(success, message, data = null) {
  const result = {
    success: success,
    message: message
  };
  
  if (data) {
    Object.assign(result, data);
  }
  
  return result;
}

/**
 * 데이터 길이 조정 유틸리티 함수
 * @param {Array} data - 원본 데이터 배열
 * @param {number} targetLength - 목표 길이
 * @return {Array} 조정된 데이터 배열
 */
function adjustDataLength(data, targetLength) {
  if (data.length === targetLength) return data;
  
  let adjustedData = [...data];
  
  if (data.length < targetLength) {
    // 데이터가 부족하면 빈 값으로 채움
    adjustedData = adjustedData.concat(Array(targetLength - data.length).fill(""));
  } else {
    // 데이터가 너무 많으면 초과분 제거
    adjustedData = adjustedData.slice(0, targetLength);
  }
  
  return adjustedData;
}

/**
 * 스프레드시트 ID 가져오기
 * @return {string|null} 스프레드시트 ID 또는 오류 시 null
 */
function getSpreadsheetId() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet().getId();
  } catch (error) {
    Logger.log("스프레드시트 ID 가져오기 오류: " + error.toString());
    return null;
  }
}

// =============== 제품 데이터 CRUD 함수 ===============

/**
 * 모든 제품 데이터 가져오기
 * @return {Object} 결과 객체 - 헤더와 데이터 포함
 */
function getAllProductData() {
  try {
    // 스프레드시트와 시트 가져오기
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    
    // 시트가 비어있는지 확인하고 비어있다면 초기 설정
    if (sheet.getLastRow() <= 1) {
      Logger.log("시트가 비어 있습니다. 초기 데이터 설정 시도...");
      const setupResult = setupInitialData();
      if (!setupResult.success) {
        return setupResult;
      }
    }
    
    // 데이터를 한 번에 가져오기 (성능 개선)
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    // 데이터가 비어있는 경우 확인
    if (data.length === 0) {
      return createResult(false, ERROR_MESSAGES.NO_DATA);
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return createResult(true, "데이터 로드 성공", { headers: headers, data: rows });
  } catch (error) {
    // 에러 로깅
    Logger.log("데이터 가져오기 에러: " + error.toString());
    return createResult(false, "데이터를 가져오는 중 오류가 발생했습니다: " + error.toString());
  }
}

/**
 * 제품 데이터 검색
 * @param {string} query - 검색 쿼리
 * @return {Object} 결과 객체
 */
function searchProductData(query) {
  try {
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 대소문자 구분 없는 검색을 위해 소문자로 변환
    const lowerQuery = query.toLowerCase();
    
    // 쿼리와 일치하는 행 필터링
    const filteredRows = rows.filter(row => {
      return row.some(cell => {
        return cell && cell.toString().toLowerCase().includes(lowerQuery);
      });
    });
    
    return createResult(true, "검색 결과", { headers: headers, data: filteredRows });
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 새 제품 데이터 추가
 * @param {Array} productData - 추가할 제품 데이터 배열
 * @return {Object} 결과 객체
 */
function addProductData(productData) {
  try {
    // 데이터 배열 유효성 검사
    if (!Array.isArray(productData)) {
      return createResult(false, ERROR_MESSAGES.INVALID_PRODUCT_DATA);
    }
    
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    
    // 헤더 수 가져오기
    const headerCount = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].length;
    
    // 데이터 길이 조정
    const adjustedData = adjustDataLength(productData, headerCount);
    
    // 새 행 추가
    sheet.appendRow(adjustedData);
    
    // 사방넷 코드 찾기 위한 헤더 정보
    const headers = getAllProductData().headers;
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    const sabangCode = adjustedData[sabangCodeIdx];
    
    // 히스토리 기록
    logProductHistory(sabangCode, [], adjustedData, 'add');
    
    return createResult(true, '제품이 성공적으로 추가되었습니다.');
  } catch (error) {
    Logger.log("addProductData 오류: " + error.toString());
    return createResult(false, '제품 추가 중 오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * 기존 제품 데이터 업데이트 - 낙관적 락 추가
 * @param {number} rowIndex - 업데이트할 행 인덱스
 * @param {Array} productData - 업데이트할 제품 데이터
 * @param {number} [lastModified] - 클라이언트의 마지막 수정 시간
 * @param {boolean} [forceUpdate] - 충돌 무시하고 강제 업데이트 여부
 * @return {Object} 결과 객체
 */
function updateProductData(rowIndex, productData, lastModified, forceUpdate) {
  try {
    // rowIndex 유효성 검사
    if (typeof rowIndex !== 'number' || rowIndex < 0) {
      return createResult(false, ERROR_MESSAGES.INVALID_ROW_INDEX + rowIndex);
    }
    
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    
    // 시트의 총 행 수 확인
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    const targetRow = rowIndex + 2; // 0-인덱싱을 위해 1, 헤더 행을 위해 1 더함
    
    if (targetRow > lastRow) {
      return createResult(false, ERROR_MESSAGES.ROW_NOT_FOUND + rowIndex);
    }
    
    // 낙관적 락: 타임스탬프 확인 (충돌 감지)
    if (!forceUpdate && lastModified) {
      const timestampCell = sheet.getRange(targetRow, lastCol);
      const currentTimestamp = timestampCell.getValue();
      
      if (currentTimestamp && currentTimestamp > lastModified) {
        return createResult(false, '다른 사용자가 이미 이 데이터를 수정했습니다. 새로고침 후 다시 시도하거나 강제 저장하세요.', {
          conflictDetected: true,
          serverTimestamp: currentTimestamp
        });
      }
    }
    
    // 데이터 배열 유효성 검사
    if (!Array.isArray(productData)) {
      return createResult(false, ERROR_MESSAGES.INVALID_PRODUCT_DATA);
    }
    
    // 헤더 수 가져오기 (타임스탬프 열 제외)
    const headerCount = lastCol - 1;
    
    // 이전 데이터 저장 (히스토리용)
    const oldData = sheet.getRange(targetRow, 1, 1, headerCount).getValues()[0];
    
    // 데이터 길이 조정
    const adjustedData = adjustDataLength(productData, headerCount);
    
    // 전체 행 한 번에 업데이트
    sheet.getRange(targetRow, 1, 1, adjustedData.length).setValues([adjustedData]);
    
    // 타임스탬프 업데이트
    const now = new Date().getTime();
    sheet.getRange(targetRow, lastCol).setValue(now);
    
    // 사방넷 코드 (히스토리용)
    const headers = getAllProductData().headers;
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    const sabangCode = adjustedData[sabangCodeIdx];
    
    // 히스토리 기록
    logProductHistory(sabangCode, oldData, adjustedData, 'update');
    
    // 데이터 잠금 해제
    unlockProduct(sabangCode);
    
    return createResult(true, '제품이 성공적으로 업데이트되었습니다.', {
      lastModified: now
    });
  } catch (error) {
    Logger.log("updateProductData 오류: " + error.toString());
    return createResult(false, '제품 업데이트 중 오류가 발생했습니다: ' + error.toString());
  }
}


/**
 * 제품 데이터 삭제
 * @param {number} rowIndex - 삭제할 행 인덱스
 * @return {Object} 결과 객체
 */
function deleteProductData(rowIndex) {
  try {
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    
    // 삭제 전 데이터 저장 (히스토리용)
    const targetRow = rowIndex + 2; // 0-인덱싱을 위해 1, 헤더 행을 위해 1 더함
    const headerCount = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].length;
    const oldData = sheet.getRange(targetRow, 1, 1, headerCount).getValues()[0];
    
    // 사방넷 코드 (히스토리용)
    const headers = getAllProductData().headers;
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    const sabangCode = oldData[sabangCodeIdx];
    
    // 행 삭제
    sheet.deleteRow(targetRow);
    
    // 히스토리 기록
    logProductHistory(sabangCode, oldData, [], 'delete');
    
    return createResult(true, '제품이 성공적으로 삭제되었습니다.');
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 사방넷 코드로 제품 데이터 조회 - 타임스탬프 포함
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체
 */
function getProductBySabangCode(sabangCode) {
  try {
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    
    // 데이터를 한 번에 가져오기 (성능 개선)
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 사방넷 코드 열 인덱스 찾기
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    if (sabangCodeIdx === -1) {
      return createResult(false, ERROR_MESSAGES.SABANGNET_COLUMN_NOT_FOUND);
    }
    
    // 타임스탬프 열 인덱스 (마지막 열)
    const timestampIdx = headers.length - 1;
    
    // 해당 사방넷 코드를 가진 제품 찾기
    const productRowIdx = rows.findIndex(row => row[sabangCodeIdx] === sabangCode);
    
    if (productRowIdx === -1) {
      return createResult(false, ERROR_MESSAGES.SABANGNET_CODE_NOT_FOUND);
    }
    
    // 제품 데이터 객체 생성 (객체 리터럴 생성 최적화)
    const product = headers.reduce((obj, header, idx) => {
      obj[header] = rows[productRowIdx][idx];
      return obj;
    }, {});
    
    // 마지막 수정 시간 가져오기
    const lastModified = rows[productRowIdx][timestampIdx];
    
    return createResult(true, "제품 조회 성공", {
      product: product,
      rowIndex: productRowIdx,
      headers: headers,
      dataRow: rows[productRowIdx],
      lastModified: lastModified
    });
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 사방넷 코드로 제품 데이터 업데이트
 * @param {string} sabangCode - 사방넷 코드
 * @param {Array} productData - 업데이트할 제품 데이터
 * @param {number} [lastModified] - 클라이언트의 마지막 수정 시간
 * @param {boolean} [forceUpdate] - 충돌 무시하고 강제 업데이트 여부
 * @return {Object} 결과 객체
 */
function updateProductBySabangCode(sabangCode, productData, lastModified, forceUpdate) {
  try {
    // 먼저 제품 행 인덱스 찾기
    const productResult = getProductBySabangCode(sabangCode);
    if (!productResult.success) {
      return productResult;
    }
    
    // 행 인덱스를 사용하여 업데이트 - 낙관적 락 적용
    return updateProductData(productResult.rowIndex, productData, lastModified, forceUpdate);
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 사방넷 코드로 제품 데이터 삭제
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체
 */
function deleteProductBySabangCode(sabangCode) {
  try {
    // 먼저 제품 행 인덱스 찾기
    const productResult = getProductBySabangCode(sabangCode);
    if (!productResult.success) {
      return productResult;
    }
    
    // 행 인덱스를 사용하여 삭제
    return deleteProductData(productResult.rowIndex);
  } catch (error) {
    return createResult(false, error.toString());
  }
}

// =============== 필드 및 메타데이터 관리 함수 ===============

/**
 * 필드 정의와 그룹 정보 함께 가져오기
 * @return {Object} 결과 객체
 */
function getFieldDefinitionsAndGroups() {
  try {
    // 병렬로 데이터 로드하고 결과 결합 - 성능 개선
    const fields = getFieldDefinitionsFromSheet();
    const groups = getFieldGroups();
    
    return createResult(true, "필드 정의 및 그룹 로드 성공", {
      fields: fields,
      groups: groups
    });
  } catch (error) {
    Logger.log("필드 정의 및 그룹 가져오기 오류: " + error.toString());
    return createResult(false, error.toString());
  }
}

/**
 * 메타데이터 시트에서 필드 정의 가져오기 - 성능 최적화
 * @return {Array} 필드 정의 객체 배열
 */
function getFieldDefinitionsFromSheet() {
  try {
    // 캐시에서 필드 정의 가져오기 시도
    const cachedDefinitions = CacheUtil.get('FIELD_DEFINITIONS', null);
    if (cachedDefinitions) {
      return cachedDefinitions;
    }
    
    const { spreadsheet } = getSpreadsheetAndSheet();
    let metaSheet = spreadsheet.getSheetByName(SHEET_NAMES.FIELD_DEFINITIONS);
    
    // 메타데이터 시트가 없으면 생성
    if (!metaSheet) {
      metaSheet = createFieldDefinitionsSheet(spreadsheet);
    }
    
    // 필드 정의 데이터를 한 번에 가져오기 (성능 개선)
    const dataRange = metaSheet.getDataRange();
    const data = dataRange.getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 필드 정의 객체 배열 생성 - reduce 사용 최적화
    const fieldDefinitions = rows.map(row => {
      // 객체 리터럴 생성 최적화
      const def = headers.reduce((obj, header, idx) => {
        obj[header] = row[idx];
        return obj;
      }, {});
      
      // options 필드가 문자열이면 배열로 변환 (메모리 최적화)
      if (def.options && typeof def.options === 'string') {
        def.options = def.options.split(',')
          .map(opt => opt.trim())
          .filter(Boolean); // 빈 문자열 제거 최적화
      } else {
        def.options = [];
      }
      
      return def;
    });
    
    // 캐시에 저장
    CacheUtil.set('FIELD_DEFINITIONS', fieldDefinitions);
    
    return fieldDefinitions;
  } catch (error) {
    Logger.log("필드 정의 가져오기 오류: " + error.toString());
    // 오류 발생 시 기존 하드코딩된 정의를 폴백으로 반환
    return getHardcodedFieldDefinitions();
  }
}

/**
 * 필드 정의 시트 생성 - 최적화 버전
 * @param {Spreadsheet=} spreadsheet - 스프레드시트 객체 (선택적)
 * @return {Sheet} 생성된 시트 객체
 */
function createFieldDefinitionsSheet(spreadsheet) {
  try {
    // spreadsheet 파라미터가 없으면 현재 활성 스프레드시트 가져오기
    if (!spreadsheet) {
      spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      if (!spreadsheet) {
        throw new Error(ERROR_MESSAGES.NO_ACTIVE_SPREADSHEET);
      }
    }
    
    // 시트가 이미 존재하는지 확인
    let metaSheet = spreadsheet.getSheetByName(SHEET_NAMES.FIELD_DEFINITIONS);
    if (metaSheet) {
      return metaSheet;
    }
    
    // 새 시트 생성
    metaSheet = spreadsheet.insertSheet(SHEET_NAMES.FIELD_DEFINITIONS);
    
    // 헤더 생성 - subGroup, subGroupOrder 필드 추가
    const headers = ['field', 'label', 'type', 'group', 'order', 'options', 'required', 'description', 'subGroup', 'subGroupOrder'];
    metaSheet.appendRow(headers);
    
    // 기본 필드 정의 추가
    setupInitialFieldDefinitions(metaSheet);
    
    // 헤더 스타일링 - 한 번에 적용 (성능 개선)
    const headerRange = metaSheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#f3f3f3')
               .setFontWeight('bold')
               .setHorizontalAlignment('center');
    
    // 캐시 초기화
    CacheUtil.remove('FIELD_DEFINITIONS');
    
    return metaSheet;
  } catch (error) {
    Logger.log("FieldDefinitions 시트 생성 중 오류: " + error.toString());
    throw error;
  }
}

/**
 * 필드 그룹 메타데이터 가져오기 - 캐싱 추가
 * @return {Object} 필드 그룹 객체
 */
function getFieldGroups() {
  try {
    // 캐시에서 그룹 정보 가져오기 시도
    const cachedGroups = CacheUtil.get('FIELD_GROUPS', null);
    if (cachedGroups) {
      return cachedGroups;
    }
    
    const { spreadsheet } = getSpreadsheetAndSheet();
    let groupSheet = spreadsheet.getSheetByName(SHEET_NAMES.FIELD_GROUPS);
    
    // 그룹 시트가 없으면 생성
    if (!groupSheet) {
      groupSheet = createFieldGroupsSheet(spreadsheet);
    }
    
    // 그룹 데이터 가져오기
    const data = groupSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 그룹 객체 생성 - reduce 사용 최적화
    const groups = rows.reduce((obj, row) => {
      const groupData = headers.reduce((groupObj, header, idx) => {
        groupObj[header] = row[idx];
        return groupObj;
      }, {});
      
      obj[groupData.group] = {
        displayName: groupData.displayName,
        order: groupData.order
      };
      
      return obj;
    }, {});
    
    // 캐시에 저장
    CacheUtil.set('FIELD_GROUPS', groups);
    
    return groups;
  } catch (error) {
    Logger.log("그룹 정의 가져오기 오류: " + error.toString());
    // 기본 그룹 반환
    return DEFAULT_FIELD_GROUPS;
  }
}

/**
 * 필드 그룹 시트 생성
 * @param {Spreadsheet} spreadsheet - 스프레드시트 객체
 * @return {Sheet} 생성된 시트 객체
 */
function createFieldGroupsSheet(spreadsheet) {
  const groupSheet = spreadsheet.insertSheet(SHEET_NAMES.FIELD_GROUPS);
  
  // 헤더 생성
  const headers = ['group', 'displayName', 'order'];
  groupSheet.appendRow(headers);
  
  // 기본 그룹 추가 - 벌크 삽입 최적화
  const defaultGroups = Object.entries(DEFAULT_FIELD_GROUPS).map(([group, info]) => 
    [group, info.displayName, info.order]
  );
  
  // 모든 행을 한 번에 추가 (성능 개선)
  if (defaultGroups.length > 0) {
    groupSheet.getRange(2, 1, defaultGroups.length, headers.length)
              .setValues(defaultGroups);
  }
  
  // 헤더 스타일링 - 한 번에 적용 (성능 개선)
  const headerRange = groupSheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#f3f3f3')
             .setFontWeight('bold')
             .setHorizontalAlignment('center');
  
  // 캐시 초기화
  CacheUtil.remove('FIELD_GROUPS');
  
  return groupSheet;
}

/**
 * 필드 정의 저장 - 캐시 무효화 추가
 * @param {Object} fieldData - 저장할 필드 데이터
 * @return {Object} 결과 객체
 */
function saveFieldDefinition(fieldData) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    let metaSheet = spreadsheet.getSheetByName(SHEET_NAMES.FIELD_DEFINITIONS);
    
    if (!metaSheet) {
      return createResult(false, 'FieldDefinitions 시트를 찾을 수 없습니다.');
    }
    
    const data = metaSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // field 열의 인덱스
    const fieldColIdx = headers.indexOf('field');
    if (fieldColIdx === -1) {
      return createResult(false, ERROR_MESSAGES.INVALID_FIELD_DEF_SHEET);
    }
    
    // 기존 필드인지 확인
    const existingRowIdx = rows.findIndex(row => row[fieldColIdx] === fieldData.field);
    
    if (existingRowIdx !== -1) {
      // 기존 필드 업데이트 - 배열 버전으로 최적화
      const rowData = headers.map(header => fieldData[header] !== undefined ? fieldData[header] : rows[existingRowIdx][headers.indexOf(header)]);
      metaSheet.getRange(existingRowIdx + 2, 1, 1, headers.length).setValues([rowData]);
    } else {
      // 새 필드 추가
      const newRow = headers.map(header => fieldData[header] || '');
      metaSheet.appendRow(newRow);
      
      // ProductData 시트에 새 열 추가
      addFieldToProductDataSheet(fieldData.field, spreadsheet);
    }
    
    // 캐시 무효화 - 필드 정의가 변경됨
    CacheUtil.remove('FIELD_DEFINITIONS');
    
    return createResult(true, '필드 정의가 저장되었습니다.');
  } catch (error) {
    Logger.log("필드 정의 저장 오류: " + error.toString());
    return createResult(false, error.toString());
  }
}

/**
 * ProductData 시트에 새 필드(열) 추가
 * @param {string} fieldName - 추가할 필드 이름
 * @param {Spreadsheet} spreadsheet - 스프레드시트 객체
 */
function addFieldToProductDataSheet(fieldName, spreadsheet) {
  try {
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.PRODUCT_DATA);
    
    if (sheet) {
      const dataHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      
      // 중복 필드가 아닌 경우에만 추가
      if (!dataHeaders.includes(fieldName)) {
        const lastCol = sheet.getLastColumn();
        sheet.getRange(1, lastCol + 1).setValue(fieldName);
      }
    }
  } catch (e) {
    Logger.log("ProductData 시트에 새 열 추가 실패: " + e.toString());
  }
}

/**
 * 필드 그룹 저장 - 캐시 무효화 추가
 * @param {Object} groupData - 저장할 그룹 데이터
 * @return {Object} 결과 객체
 */
function saveFieldGroup(groupData) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    let groupSheet = spreadsheet.getSheetByName(SHEET_NAMES.FIELD_GROUPS);
    
    if (!groupSheet) {
      return createResult(false, 'FieldGroups 시트를 찾을 수 없습니다.');
    }
    
    const data = groupSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // group 열의 인덱스
    const groupColIdx = headers.indexOf('group');
    if (groupColIdx === -1) {
      return createResult(false, ERROR_MESSAGES.INVALID_FIELD_GROUP_SHEET);
    }
    
    // 기존 그룹인지 확인
    const existingRowIdx = rows.findIndex(row => row[groupColIdx] === groupData.group);
    
    if (existingRowIdx !== -1) {
      // 기존 그룹 업데이트 - 배열 버전으로 최적화
      const rowData = headers.map(header => groupData[header] !== undefined ? groupData[header] : rows[existingRowIdx][headers.indexOf(header)]);
      groupSheet.getRange(existingRowIdx + 2, 1, 1, headers.length).setValues([rowData]);
    } else {
      // 새 그룹 추가
      const newRow = headers.map(header => groupData[header] || '');
      groupSheet.appendRow(newRow);
    }
    
    // 캐시 무효화 - 그룹 정보가 변경됨
    CacheUtil.remove('FIELD_GROUPS');
    
    return createResult(true, '필드 그룹이 저장되었습니다.');
  } catch (error) {
    Logger.log("필드 그룹 저장 오류: " + error.toString());
    return createResult(false, error.toString());
  }
}

/**
 * 이전의 하드코딩된 필드 정의 (폴백용)
 * @return {Array} 필드 정의 객체 배열
 */
function getHardcodedFieldDefinitions() {
  // 하위 그룹 정의
  const subGroups = {
    '기본 정보': {
      '제품 식별 정보': ['사방넷코드', '바코드', '쿠팡ID', 'ERPIA'],
      '제품명': ['제품명_발주점검시트', '제품명_오퍼리스트(한국어)', '제품명_오퍼리스트(영어)', '단상자명'],
      '제품 특성': ['브랜드', '카테고리', '구분', '제조사', '국가'],
      '규격 정보': ['용량', '용량_단위', '개입수_수량', '개입수_단위'],
      '상태 정보': ['운영여부', '출시연월']
    },
    '물류 정보': {
      '제품 크기': ['내용물_장(mm)', '내용물_폭(mm)', '내용물_고(mm)', '내용물_중량(g)'],
      '포장 정보': ['아웃박스', '아웃박스_장(mm)', '아웃박스_폭(mm)', '아웃박스_고(mm)', '아웃박스_중량(g)', '박스 입수량', '내용량 중량(1 box)'],
      '파레트 정보': ['파레트단당박스갯수', '파레트최대단수', '완파레트', '완파레트_적재율', '완파레트_높이'],
      '운송 정보': ['컨테이너', '유통기한']
    },
    '디자인/인증 정보': {
      '성분 정보': ['PH', '20가지주의성분', 'FS(전성분)', '전성분', 'INGREDIENT', '전성분(표기법 변경)', 'INGREDIENT(표기법 변경)'],
      '안전성 정보': ['EWG', '피부자극테스트', 'cmit/mit'],
      '인증 및 법적 정보': ['MSDS', 'KCL성적서', '신고증명서', '인허가', '포장재 신고여부']
    }
  };
  
  // 필드 목록에 subGroup과 subGroupOrder 추가
  const baseFields = [
    // 기본 정보 그룹
    { field: '브랜드', label: '브랜드', type: 'text', group: '기본 정보', order: 1, required: true },
    { field: '카테고리', label: '카테고리', type: 'text', group: '기본 정보', order: 2 },
    { field: '구분', label: '구분', type: 'text', group: '기본 정보', order: 3 },
    { field: '쿠팡ID', label: '쿠팡ID', type: 'text', group: '기본 정보', order: 4 },
    { field: 'ERPIA', label: 'ERPIA', type: 'text', group: '기본 정보', order: 5 },
    { field: '바코드', label: '바코드', type: 'text', group: '기본 정보', order: 6 },
    { field: '사방넷코드', label: '사방넷코드', type: 'text', group: '기본 정보', order: 7, required: true },
    { field: '제품명_발주점검시트', label: '제품명 (발주점검시트)', type: 'text', group: '기본 정보', order: 8, required: true },
    { field: '제품명_오퍼리스트(한국어)', label: '제품명 (한국어)', type: 'text', group: '기본 정보', order: 9 },
    { field: '제품명_오퍼리스트(영어)', label: '제품명 (영어)', type: 'text', group: '기본 정보', order: 10 },
    { field: '단상자명', label: '단상자명', type: 'text', group: '기본 정보', order: 11 },
    { field: '용량', label: '용량', type: 'text', group: '기본 정보', order: 12 },
    { field: '용량_단위', label: '용량 단위', type: 'text', group: '기본 정보', order: 13 },
    { field: '개입수_수량', label: '개입수 수량', type: 'number', group: '기본 정보', order: 14 },
    { field: '개입수_단위', label: '개입수 단위', type: 'text', group: '기본 정보', order: 15 },
    { field: '제조사', label: '제조사', type: 'text', group: '기본 정보', order: 16 },
    { field: '운영여부', label: '운영여부', type: 'select', group: '기본 정보', order: 17, options: ['운영', '비운영'] },
    { field: '국가', label: '국가', type: 'text', group: '기본 정보', order: 18 },
    { field: '출시연월', label: '출시연월', type: 'date', group: '기본 정보', order: 19 },
    
    // 물류 정보 그룹
    { field: '내용물_장(mm)', label: '내용물 장(mm)', type: 'number', group: '물류 정보', order: 1 },
    { field: '내용물_폭(mm)', label: '내용물 폭(mm)', type: 'number', group: '물류 정보', order: 2 },
    { field: '내용물_고(mm)', label: '내용물 고(mm)', type: 'number', group: '물류 정보', order: 3 },
    { field: '내용물_중량(g)', label: '내용물 중량(g)', type: 'number', group: '물류 정보', order: 4 },
    { field: '아웃박스', label: '아웃박스', type: 'text', group: '물류 정보', order: 5 },
    { field: '아웃박스_장(mm)', label: '아웃박스 장(mm)', type: 'number', group: '물류 정보', order: 6 },
    { field: '아웃박스_폭(mm)', label: '아웃박스 폭(mm)', type: 'number', group: '물류 정보', order: 7 },
    { field: '아웃박스_고(mm)', label: '아웃박스 고(mm)', type: 'number', group: '물류 정보', order: 8 },
    { field: '아웃박스_중량(g)', label: '아웃박스 중량(g)', type: 'number', group: '물류 정보', order: 9 },
    { field: '파레트단당박스갯수', label: '파레트 단당 박스 개수', type: 'number', group: '물류 정보', order: 10 },
    { field: '파레트최대단수', label: '파레트 최대 단수', type: 'number', group: '물류 정보', order: 11 },
    { field: '박스 입수량', label: '박스 입수량', type: 'number', group: '물류 정보', order: 12 },
    { field: '내용량 중량(1 box)', label: '내용량 중량(1 box)', type: 'number', group: '물류 정보', order: 13 },
    { field: '완파레트', label: '완파레트', type: 'text', group: '물류 정보', order: 14 },
    { field: '완파레트_적재율', label: '완파레트 적재율', type: 'number', group: '물류 정보', order: 15 },
    { field: '완파레트_높이', label: '완파레트 높이', type: 'number', group: '물류 정보', order: 16 },
    { field: '컨테이너', label: '컨테이너', type: 'text', group: '물류 정보', order: 17 },
    
    // 디자인/인증 정보 그룹
    { field: '유통기한', label: '유통기한', type: 'text', group: '디자인/인증 정보', order: 1 },
    { field: 'PH', label: 'PH', type: 'number', group: '디자인/인증 정보', order: 2 },
    { field: '20가지주의성분', label: '20가지 주의성분', type: 'text', group: '디자인/인증 정보', order: 3 },
    { field: 'EWG', label: 'EWG', type: 'text', group: '디자인/인증 정보', order: 4 },
    { field: '피부자극테스트', label: '피부자극테스트', type: 'select', group: '디자인/인증 정보', order: 5, options: ['통과', '미통과', '진행중'] },
    { field: 'cmit/mit', label: 'cmit/mit', type: 'select', group: '디자인/인증 정보', order: 6, options: ['포함', '미포함'] },
    { field: 'MSDS', label: 'MSDS', type: 'select', group: '디자인/인증 정보', order: 7, options: ['있음', '없음'] },
    { field: 'FS(전성분)', label: 'FS(전성분)', type: 'textarea', group: '디자인/인증 정보', order: 8 },
    { field: '전성분', label: '전성분', type: 'textarea', group: '디자인/인증 정보', order: 9 },
    { field: 'INGREDIENT', label: 'INGREDIENT', type: 'textarea', group: '디자인/인증 정보', order: 10 },
    { field: '전성분(표기법 변경)', label: '전성분(표기법 변경)', type: 'textarea', group: '디자인/인증 정보', order: 11 },
    { field: 'INGREDIENT(표기법 변경)', label: 'INGREDIENT(표기법 변경)', type: 'textarea', group: '디자인/인증 정보', order: 12 },
    { field: 'KCL성적서', label: 'KCL성적서', type: 'select', group: '디자인/인증 정보', order: 13, options: ['있음', '없음'] },
    { field: '신고증명서', label: '신고증명서', type: 'select', group: '디자인/인증 정보', order: 14, options: ['있음', '없음'] },
    { field: '인허가', label: '인허가', type: 'select', group: '디자인/인증 정보', order: 15, options: ['있음', '없음'] },
    { field: '포장재 신고여부', label: '포장재 신고여부', type: 'select', group: '디자인/인증 정보', order: 16, options: ['신고완료', '미신고'] }
  ];
  
  // 각 필드에 하위 그룹 정보 추가 - Map 사용으로 최적화
  const subGroupMap = new Map();
  
  // 하위 그룹 맵 구성
  Object.entries(subGroups).forEach(([group, groupSubGroups]) => {
    Object.entries(groupSubGroups).forEach(([subGroupName, fieldNames]) => {
      fieldNames.forEach((fieldName, idx) => {
        subGroupMap.set(fieldName, {
          subGroup: subGroupName,
          subGroupOrder: idx + 1
        });
      });
    });
  });
  
  const fieldsWithSubGroups = baseFields.map(field => {
    const subGroupInfo = subGroupMap.get(field.field);
    return {
      ...field,
      subGroup: subGroupInfo ? subGroupInfo.subGroup : "",
      subGroupOrder: subGroupInfo ? subGroupInfo.subGroupOrder : 0
    };
  });
  
  return fieldsWithSubGroups;
}

/**
 * 필드 하위 그룹 정보 저장
 * @param {string} fieldName - 필드 이름
 * @param {string} subGroup - 하위 그룹 이름
 * @param {number} subGroupOrder - 하위 그룹 내 순서
 * @return {Object} 결과 객체
 */
function saveFieldSubGroupInfo(fieldName, subGroup, subGroupOrder) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    let metaSheet = spreadsheet.getSheetByName(SHEET_NAMES.FIELD_DEFINITIONS);
    
    if (!metaSheet) {
      return createResult(false, 'FieldDefinitions 시트를 찾을 수 없습니다.');
    }
    
    const data = metaSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 필요한 열 인덱스 찾기
    const fieldColIdx = headers.indexOf('field');
    const subGroupColIdx = headers.indexOf('subGroup');
    const subGroupOrderColIdx = headers.indexOf('subGroupOrder');
    
    if (fieldColIdx === -1 || subGroupColIdx === -1 || subGroupOrderColIdx === -1) {
      return createResult(false, '필요한 열을 찾을 수 없습니다.');
    }
    
    // 필드 찾기
    const rowIdx = rows.findIndex(row => row[fieldColIdx] === fieldName);
    
    if (rowIdx === -1) {
      return createResult(false, '필드를 찾을 수 없습니다: ' + fieldName);
    }
    
    // 하위 그룹 정보 업데이트 - 한 번에 업데이트로 최적화
    const rangeValues = [[subGroup, subGroupOrder]];
    metaSheet.getRange(rowIdx + 2, subGroupColIdx + 1, 1, 2).setValues(rangeValues);
    
    // 캐시 무효화
    CacheUtil.remove('FIELD_DEFINITIONS');
    
    return createResult(true, '하위 그룹 정보가 업데이트되었습니다.');
  } catch (error) {
    Logger.log("하위 그룹 정보 저장 오류: " + error.toString());
    return createResult(false, error.toString());
  }
}

/**
 * 그룹별 하위 그룹 목록 가져오기
 * @return {Object} 그룹별 하위 그룹 목록
 */
function getSubGroupsByGroup() {
  try {
    // 필드 정의 가져오기
    const fieldDefs = getFieldDefinitionsFromSheet();
    
    // 그룹별 하위 그룹 구성 - Map 사용으로 최적화
    const subGroups = {};
    
    // 필드를 그룹과 하위 그룹으로 구성
    fieldDefs.forEach(field => {
      const group = field.group || '기타';
      const subGroup = field.subGroup;
      
      if (subGroup) {
        if (!subGroups[group]) {
          subGroups[group] = {};
        }
        
        if (!subGroups[group][subGroup]) {
          subGroups[group][subGroup] = [];
        }
        
        subGroups[group][subGroup].push({
          field: field.field,
          label: field.label,
          order: field.subGroupOrder || 0
        });
      }
    });
    
    // 각 하위 그룹 내 필드를 순서대로 정렬
    Object.keys(subGroups).forEach(group => {
      Object.keys(subGroups[group]).forEach(subGroup => {
        subGroups[group][subGroup].sort((a, b) => a.order - b.order);
      });
    });
    
    return createResult(true, '하위 그룹 정보를 가져왔습니다.', { subGroups });
  } catch (error) {
    Logger.log("하위 그룹 정보 가져오기 오류: " + error.toString());
    return createResult(false, error.toString());
  }
}

/**
 * 초기 필드 정의 설정 (벌크 삽입 최적화)
 * @param {Sheet} sheet - 필드 정의 시트 객체
 */
function setupInitialFieldDefinitions(sheet) {
  // 기존 필드 정의를 메타데이터 형식으로 변환
  const initialFields = getHardcodedFieldDefinitions();
  
  // 여러 행 한 번에 추가하기 위한 배열 생성
  const rowsData = initialFields.map(fieldDef => {
    let options = "";
    if (fieldDef.options && Array.isArray(fieldDef.options)) {
      options = fieldDef.options.join(',');
    }
    
    let required = fieldDef.required || false;
    let description = fieldDef.description || "";
    let subGroup = fieldDef.subGroup || "";
    let subGroupOrder = fieldDef.subGroupOrder || 0;
    
    return [
      fieldDef.field,
      fieldDef.label,
      fieldDef.type,
      fieldDef.group,
      fieldDef.order,
      options,
      required,
      description,
      subGroup,
      subGroupOrder
    ];
  });
  
  // 모든 행을 한 번에 추가 (성능 향상)
  if (rowsData.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rowsData.length, rowsData[0].length).setValues(rowsData);
  }
}

/**
 * 필드 삭제
 * @param {string} fieldName - 삭제할 필드 이름
 * @return {Object} 결과 객체
 */
function deleteFieldDefinition(fieldName) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    let metaSheet = spreadsheet.getSheetByName(SHEET_NAMES.FIELD_DEFINITIONS);
    
    if (!metaSheet) {
      return createResult(false, 'FieldDefinitions 시트를 찾을 수 없습니다.');
    }
    
    const data = metaSheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // field 열의 인덱스
    const fieldColIdx = headers.indexOf('field');
    if (fieldColIdx === -1) {
      return createResult(false, ERROR_MESSAGES.INVALID_FIELD_DEF_SHEET);
    }
    
    // 필드 위치 찾기
    const rowIdx = rows.findIndex(row => row[fieldColIdx] === fieldName);
    
    if (rowIdx === -1) {
      return createResult(false, ERROR_MESSAGES.FIELD_NOT_FOUND + fieldName);
    }
    
    // 메타데이터 시트에서 행 삭제
    metaSheet.deleteRow(rowIdx + 2); // 헤더 행 고려 +2
    
    // 캐시 무효화
    CacheUtil.remove('FIELD_DEFINITIONS');
    
    return createResult(true, '필드가 성공적으로 삭제되었습니다.');
  } catch (error) {
    Logger.log("필드 삭제 오류: " + error.toString());
    return createResult(false, error.toString());
  }
}

// =============== 초기화 및 샘플 데이터 ===============

/**
 * 제품 데이터 테이블에 타임스탬프 열 추가
 * @return {Object} 결과 객체
 */
function addTimestampColumnToProductData() {
  try {
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    const lastColumn = sheet.getLastColumn();
    
    // 이미 타임스탬프 열이 있는지 확인
    const headerRange = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    if (headerRange.includes('수정시간')) {
      return createResult(true, '타임스탬프 열이 이미 존재합니다.');
    }
    
    // 타임스탬프 열 추가
    sheet.getRange(1, lastColumn + 1).setValue('수정시간');
    
    // 모든 행에 현재 시간 설정
    const dataRange = sheet.getRange(2, lastColumn + 1, sheet.getLastRow() - 1, 1);
    const now = new Date().getTime();
    const timestamps = Array(sheet.getLastRow() - 1).fill([now]);
    dataRange.setValues(timestamps);
    
    return createResult(true, '타임스탬프 열이 추가되었습니다.');
  } catch (error) {
    Logger.log("타임스탬프 열 추가 오류: " + error.toString());
    return createResult(false, '타임스탬프 열 추가 중 오류가 발생했습니다: ' + error.toString());
  }
}


/**
 * 초기 데이터 설정 (스프레드시트가 비어있는 경우)
 * @return {Object} 결과 객체
 */
function setupInitialData() {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAMES.PRODUCT_DATA);
    
    // 시트가 없으면 생성
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_NAMES.PRODUCT_DATA);
    }
    
    // 메타데이터 시트 초기화도 함께 진행
    try {
      getFieldDefinitionsFromSheet();
      getFieldGroups();
    } catch (metaError) {
      Logger.log("메타데이터 초기화 오류: " + metaError.toString());
    }
    
    // 헤더가 없는지 확인 (첫 행이 비어있거나 1행 1열이 비어있는 경우)
    const range = sheet.getRange(1, 1, 1, 1);
    if (range.isBlank() || sheet.getLastRow() === 0) {
      // 필드 정의에서 헤더 추출
      const fieldDefs = getFieldDefinitionsFromSheet();
      const headers = fieldDefs.map(def => def.field);
      
      // 기존 헤더가 있는지 확인하고 있으면 삭제
      if (sheet.getLastRow() > 0) {
        sheet.deleteRow(1);
      }
      
      // 헤더 추가
      sheet.appendRow(headers);
      
      // 헤더 스타일링 - 한 번에 적용 (성능 개선)
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#f3f3f3')
                 .setFontWeight('bold')
                 .setHorizontalAlignment('center');
      
      // 열 너비 자동 조정
      sheet.autoResizeColumns(1, headers.length);
      
      // 첫 번째 행 고정
      sheet.setFrozenRows(1);
      
      // 샘플 데이터 추가
      addSampleData(sheet, headers);

      // 타임스탬프 열 추가
      addTimestampColumnToProductData();
          
      return createResult(true, '초기 데이터 설정이 완료되었습니다.');
    }
    
    return createResult(true, '데이터가 이미 설정되어 있습니다.');
  } catch (error) {
    Logger.log("초기 데이터 설정 에러: " + error.toString());
    return createResult(false, error.toString());
  }
}

/**
 * 샘플 데이터 추가 - 벌크 삽입 최적화
 * @param {Sheet} sheet - 시트 객체
 * @param {Array} headers - 헤더 배열
 */
function addSampleData(sheet, headers) {
  // 샘플 제품 데이터 객체 배열
  const sampleProducts = [
    { 
      '브랜드': '브랜드A', 
      '카테고리': '스킨케어', 
      '구분': '일반',
      '쿠팡ID': 'CP001',
      'ERPIA': 'EP001',
      '바코드': '8801234567890',
      '사방넷코드': 'SB001', 
      '제품명_발주점검시트': '샘플 제품 A',
      '제품명_오퍼리스트(한국어)': '샘플 제품 A (한국어)',
      '제품명_오퍼리스트(영어)': 'Sample Product A (English)',
      '단상자명': '단상자A',
      '용량': '100',
      '용량_단위': 'ml',
      '개입수_수량': 1,
      '개입수_단위': '개',
      '제조사': '제조사A',
      '운영여부': '운영',
      '국가': '한국',
      '출시연월': '2024-01',
      '내용물_장(mm)': 50,
      '내용물_폭(mm)': 30,
      '내용물_(mm)': 100,
      '내용물_중량(g)': 120,
      '아웃박스': '아웃박스A',
      '아웃박스_장(mm)': 300,
      '아웃박스_폭(mm)': 200,
      '아웃박스_고(mm)': 150,
      '아웃박스_중량(g)': 500,
      '파레트단당박스갯수': 20,
      '파레트최대단수': 5,
      '박스 입수량': 24,
      '내용량 중량(1 box)': 3000,
      '완파레트': '완파렛A',
      '완파레트_적재율': 80,
      '완파레트_높이': 180,
      '컨테이너': '40ft',
      '유통기한': '24개월',
      'PH': 5.5,
      '20가지주의성분': '없음',
      'EWG': '그린',
      '피부자극테스트': '통과',
      'cmit/mit': '미포함',
      'MSDS': '있음',
      'FS(전성분)': '전성분 리스트',
      '전성분': '정제수, 글리세린...',
      'INGREDIENT': 'Water, Glycerin...',
      '전성분(표기법 변경)': '정제수, 글리세린(변경)...',
      'INGREDIENT(표기법 변경)': 'Water, Glycerin(modified)...',
      'KCL성적서': '있음',
      '신고증명서': '있음',
      '인허가': '있음',
      '포장재 신고여부': '신고완료'
    },
    { 
      '브랜드': '브랜드B', 
      '카테고리': '헤어케어', 
      '구분': '기능성',
      '쿠팡ID': 'CP002',
      'ERPIA': 'EP002',
      '바코드': '8809876543210',
      '사방넷코드': 'SB002', 
      '제품명_발주점검시트': '샘플 제품 B',
      '제품명_오퍼리스트(한국어)': '샘플 제품 B (한국어)',
      '제품명_오퍼리스트(영어)': 'Sample Product B (English)',
      '단상자명': '단상자B',
      '용량': '200',
      '용량_단위': 'ml',
      '개입수_수량': 2,
      '개입수_단위': '개',
      '제조사': '제조사B',
      '운영여부': '운영',
      '국가': '한국',
      '출시연월': '2024-02',
      '내용물_장(mm)': 60,
      '내용물_폭(mm)': 40,
      '내용물_(mm)': 120,
      '내용물_중량(g)': 150,
      '아웃박스': '아웃박스B',
      '아웃박스_장(mm)': 400,
      '아웃박스_폭(mm)': 300,
      '아웃박스_고(mm)': 200,
      '아웃박스_중량(g)': 600,
      '파레트단당박스갯수': 18,
      '파레트최대단수': 4,
      '박스 입수량': 20,
      '내용량 중량(1 box)': 3500,
      '완파레트': '완파렛B',
      '완파레트_적재율': 75,
      '완파레트_높이': 170,
      '컨테이너': '20ft',
      '유통기한': '36개월',
      'PH': 6.0,
      '20가지주의성분': '없음',
      'EWG': '옐로우',
      '피부자극테스트': '통과',
      'cmit/mit': '미포함',
      'MSDS': '있음',
      'FS(전성분)': '전성분 리스트',
      '전성분': '정제수, 글리세린...',
      'INGREDIENT': 'Water, Glycerin...',
      '전성분(표기법 변경)': '정제수, 글리세린(변경)...',
      'INGREDIENT(표기법 변경)': 'Water, Glycerin(modified)...',
      'KCL성적서': '있음',
      '신고증명서': '있음',
      '인허가': '있음',
      '포장재 신고여부': '신고완료'
    }
  ];

  // 각 샘플 제품을 헤더와 맞춰 데이터 배열 생성 - 벌크 삽입 최적화
  const rowsData = sampleProducts.map(product => {
    return headers.map(header => {
      return product[header] !== undefined ? product[header] : '';
    });
  });
  
  // 한 번에 여러 행 추가 (성능 개선)
  if (rowsData.length > 0) {
    sheet.getRange(2, 1, rowsData.length, headers.length).setValues(rowsData);
  }
}

// =============== 부자재 정보 관련 함수 ===============

/**
 * 모든 부자재 데이터 가져오기
 * @return {Object} 결과 객체 - 헤더와 데이터 포함
 */
function getAllAccessoriesData() {
  try {
    // 스프레드시트와 시트 가져오기
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    
    if (!sheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    
    // 데이터 가져오기
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    // 데이터가 비어있는 경우 확인
    if (data.length === 0) {
      return createResult(false, '부자재 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return createResult(true, "부자재 데이터 로드 성공", { headers: headers, data: rows });
  } catch (error) {
    // 에러 로깅
    Logger.log("부자재 데이터 가져오기 에러: " + error.toString());
    return createResult(false, "부자재 데이터를 가져오는 중 오류가 발생했습니다: " + error.toString());
  }
}

/**
 * 부자재 데이터 검색
 * @param {string} query - 검색 쿼리
 * @return {Object} 결과 객체
 */
function searchAccessoriesData(query) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    
    if (!sheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 대소문자 구분 없는 검색을 위해 소문자로 변환
    const lowerQuery = query.toLowerCase();
    
    // 쿼리와 일치하는 행 필터링
    const filteredRows = rows.filter(row => {
      return row.some(cell => {
        return cell && cell.toString().toLowerCase().includes(lowerQuery);
      });
    });
    
    return createResult(true, "검색 결과", { headers: headers, data: filteredRows });
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 사방넷 코드로 부자재 데이터 가져오기
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체
 */
function getAccessoriesBySabangCode(sabangCode) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const accessoriesSheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    const masterSheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!accessoriesSheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    
    if (!masterSheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    // 부자재 정보 시트 데이터 가져오기
    const accessoriesData = accessoriesSheet.getDataRange().getValues();
    const accessoriesHeaders = accessoriesData[0];
    const accessoriesRows = accessoriesData.slice(1);
    
    // 사방넷 코드 열 인덱스 찾기
    const sabangCodeIdx = accessoriesHeaders.indexOf('사방넷코드');
    if (sabangCodeIdx === -1) {
      return createResult(false, '사방넷코드 열을 찾을 수 없습니다.');
    }
    
    // 해당 사방넷 코드를 가진 행들 필터링
    const filteredRows = accessoriesRows.filter(row => row[sabangCodeIdx] === sabangCode);
    
    if (filteredRows.length === 0) {
      return createResult(true, "해당 제품의 부자재 정보가 없습니다.", { headers: accessoriesHeaders, data: [] });
    }
    
    // 부자재 마스터 시트 데이터 가져오기
    const masterData = masterSheet.getDataRange().getValues();
    const masterHeaders = masterData[0];
    const masterRows = masterData.slice(1);
    
    // 부자재 코드 열 인덱스 찾기
    const accessoryCodeIdx = accessoriesHeaders.indexOf('부자재코드');
    const masterAccessoryCodeIdx = masterHeaders.indexOf('부자재코드');
    
    if (accessoryCodeIdx === -1 || masterAccessoryCodeIdx === -1) {
      return createResult(false, '부자재코드 열을 찾을 수 없습니다.');
    }
    
    // 각 부자재 정보에 마스터 정보를 결합
    const enrichedRows = filteredRows.map(row => {
      const accessoryCode = row[accessoryCodeIdx];
      
      // 마스터 시트에서 해당 부자재 코드를 가진 행 찾기
      const masterRow = masterRows.find(masterRow => masterRow[masterAccessoryCodeIdx] === accessoryCode);
      
      if (masterRow) {
        // 마스터 시트의 정보를 합쳐서 반환
        const result = [...row];
        
        // 마스터 시트의 추가 정보를 붙여서 반환
        // 중복되는 컬럼은 마스터 시트의 값으로 덮어씀
        masterHeaders.forEach((header, idx) => {
          const accessoryHeaderIdx = accessoriesHeaders.indexOf(header);
          if (accessoryHeaderIdx === -1) {
            // 부자재 정보에 없는 마스터 정보는 추가
            accessoriesHeaders.push(header);
            result.push(masterRow[idx]);
          } else if (header !== '부자재코드') {
            // 부자재코드를 제외한 중복 필드는 마스터 값으로 덮어씀
            result[accessoryHeaderIdx] = masterRow[idx];
          }
        });
        
        return result;
      }
      
      return row; // 마스터에 정보가 없으면 원래 정보 그대로 반환
    });
    
    return createResult(true, "부자재 조회 성공", { headers: accessoriesHeaders, data: enrichedRows });
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 부자재 코드로 부자재 데이터 가져오기
 * @param {string} accessoryCode - 부자재 코드
 * @return {Object} 결과 객체
 */
function getAccessoryByCode(accessoryCode) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    
    if (!sheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 부자재 코드 열 인덱스 찾기
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    if (accessoryCodeIdx === -1) {
      return createResult(false, '부자재코드 열을 찾을 수 없습니다.');
    }
    
    // 해당 부자재 코드를 가진 행 필터링
    const filteredRows = rows.filter(row => row[accessoryCodeIdx] === accessoryCode);
    
    if (filteredRows.length === 0) {
      return createResult(false, "해당 부자재 정보를 찾을 수 없습니다.");
    }
    
    // 부자재 데이터 객체 생성
    const accessory = {};
    filteredRows[0].forEach((value, idx) => {
      accessory[headers[idx]] = value;
    });
    
    return createResult(true, "부자재 조회 성공", { accessory: accessory });
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 부자재 마스터 데이터 가져오기
 * @return {Object} 결과 객체 - 헤더와 데이터 포함
 */
function getAllAccessoriesMasterData() {
  try {
    // 스프레드시트와 시트 가져오기
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!sheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    // 데이터 가져오기
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    // 데이터가 비어있는 경우 확인
    if (data.length === 0) {
      return createResult(false, '부자재 마스터 데이터가 없습니다.');
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    return createResult(true, "부자재 마스터 데이터 로드 성공", { headers: headers, data: rows });
  } catch (error) {
    // 에러 로깅
    Logger.log("부자재 마스터 데이터 가져오기 에러: " + error.toString());
    return createResult(false, "부자재 마스터 데이터를 가져오는 중 오류가 발생했습니다: " + error.toString());
  }
}

/**
 * 부자재 마스터 데이터 검색
 * @param {string} query - 검색 쿼리
 * @return {Object} 결과 객체
 */
function searchAccessoriesMasterData(query) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!sheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 대소문자 구분 없는 검색을 위해 소문자로 변환
    const lowerQuery = query.toLowerCase();
    
    // 쿼리와 일치하는 행 필터링
    const filteredRows = rows.filter(row => {
      return row.some(cell => {
        return cell && cell.toString().toLowerCase().includes(lowerQuery);
      });
    });
    
    return createResult(true, "검색 결과", { headers: headers, data: filteredRows });
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 부자재 코드로 부자재 마스터 데이터 가져오기
 * @param {string} accessoryCode - 부자재 코드
 * @return {Object} 결과 객체
 */
function getMasterAccessoryByCode(accessoryCode) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!sheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 부자재 코드 열 인덱스 찾기
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    if (accessoryCodeIdx === -1) {
      return createResult(false, '부자재코드 열을 찾을 수 없습니다.');
    }
    
    // 해당 부자재 코드를 가진 행 필터링
    const filteredRows = rows.filter(row => row[accessoryCodeIdx] === accessoryCode);
    
    if (filteredRows.length === 0) {
      return createResult(false, "해당 부자재 정보를 찾을 수 없습니다.");
    }
    
    // 부자재 데이터 객체 생성
    const accessory = {};
    filteredRows[0].forEach((value, idx) => {
      accessory[headers[idx]] = value;
    });
    
    return createResult(true, "부자재 마스터 조회 성공", { accessory: accessory });
  } catch (error) {
    return createResult(false, error.toString());
  }
}

/**
 * 새 부자재 마스터 추가
 * @param {Object} accessoryData - 부자재 데이터 객체
 * @return {Object} 결과 객체
 */
function addAccessoryMaster(accessoryData) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!sheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 부자재 코드 존재 여부 확인
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    if (accessoryCodeIdx === -1) {
      return createResult(false, '부자재코드 열을 찾을 수 없습니다.');
    }
    
    // 부자재 코드 중복 확인
    if (!accessoryData['부자재코드']) {
      return createResult(false, '부자재코드는 필수입니다.');
    }
    
    const existingAccessory = rows.find(row => row[accessoryCodeIdx] === accessoryData['부자재코드']);
    if (existingAccessory) {
      return createResult(false, '이미 존재하는 부자재코드입니다: ' + accessoryData['부자재코드']);
    }
    
    // 새 행 데이터 준비
    const newRowData = headers.map(header => {
      return accessoryData[header] !== undefined ? accessoryData[header] : '';
    });
    
    // 시트에 새 행 추가
    sheet.appendRow(newRowData);
    
    // 변경 내역 기록 (선택적)
    recordChangeHistory('add', '부자재마스터', null, accessoryData);
    
    return createResult(true, "부자재 마스터 추가 성공", { accessory: accessoryData });
  } catch (error) {
    return createResult(false, "부자재 마스터 추가 중 오류 발생: " + error.toString());
  }
}

/**
 * 기존 부자재 마스터 정보 업데이트
 * @param {string} accessoryCode - 부자재 코드
 * @param {Object} accessoryData - 업데이트할 부자재 데이터
 * @return {Object} 결과 객체
 */
function updateAccessoryMaster(accessoryCode, accessoryData) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!sheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 부자재 코드 열 인덱스 찾기
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    if (accessoryCodeIdx === -1) {
      return createResult(false, '부자재코드 열을 찾을 수 없습니다.');
    }
    
    // 해당 부자재 코드를 가진 행 찾기
    const rowIndex = rows.findIndex(row => row[accessoryCodeIdx] === accessoryCode);
    if (rowIndex === -1) {
      return createResult(false, '해당 부자재코드를 찾을 수 없습니다: ' + accessoryCode);
    }
    
    // 기존 데이터 가져오기
    const oldData = {};
    headers.forEach((header, idx) => {
      oldData[header] = rows[rowIndex][idx];
    });
    
    // 새 데이터 준비 (기존 데이터 + 업데이트 데이터)
    const newData = { ...oldData };
    Object.keys(accessoryData).forEach(key => {
      if (headers.includes(key)) {
        newData[key] = accessoryData[key];
      }
    });
    
    // 새 행 데이터 준비
    const updatedRowData = headers.map(header => {
      return newData[header] !== undefined ? newData[header] : '';
    });
    
    // 시트 업데이트 (행 인덱스는 0 기반이므로 +2를 해서 실제 행 번호로 변환)
    sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([updatedRowData]);
    
    // 변경 내역 기록 (선택적)
    recordChangeHistory('update', '부자재마스터', oldData, newData);
    
    return createResult(true, "부자재 마스터 업데이트 성공", { accessory: newData });
  } catch (error) {
    return createResult(false, "부자재 마스터 업데이트 중 오류 발생: " + error.toString());
  }
}

/**
 * 부자재 마스터 삭제
 * @param {string} accessoryCode - 삭제할 부자재 코드
 * @return {Object} 결과 객체
 */
function deleteAccessoryMaster(accessoryCode) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!sheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 부자재 코드 열 인덱스 찾기
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    if (accessoryCodeIdx === -1) {
      return createResult(false, '부자재코드 열을 찾을 수 없습니다.');
    }
    
    // 해당 부자재 코드를 가진 행 찾기
    const rowIndex = rows.findIndex(row => row[accessoryCodeIdx] === accessoryCode);
    if (rowIndex === -1) {
      return createResult(false, '해당 부자재코드를 찾을 수 없습니다: ' + accessoryCode);
    }
    
    // 부자재 정보 시트에서 이 부자재를 사용 중인지 확인
    const result = isAccessoryInUse(accessoryCode);
    if (result.inUse) {
      return createResult(false, `이 부자재는 ${result.productCount}개의 제품에서 사용 중이므로 삭제할 수 없습니다.`);
    }
    
    // 삭제 전 데이터 저장
    const oldData = {};
    headers.forEach((header, idx) => {
      oldData[header] = rows[rowIndex][idx];
    });
    
    // 행 삭제 (행 인덱스는 0 기반이므로 +2를 해서 실제 행 번호로 변환)
    sheet.deleteRow(rowIndex + 2);
    
    // 변경 내역 기록 (선택적)
    recordChangeHistory('delete', '부자재마스터', oldData, null);
    
    return createResult(true, "부자재 마스터 삭제 성공");
  } catch (error) {
    return createResult(false, "부자재 마스터 삭제 중 오류 발생: " + error.toString());
  }
}

/**
 * 부자재가 제품에서 사용 중인지 확인
 * @param {string} accessoryCode - 부자재 코드
 * @return {Object} 사용 중 여부 및 사용 제품 수
 */
function isAccessoryInUse(accessoryCode) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    
    if (!sheet) {
      return { inUse: false, productCount: 0 };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 부자재 코드 열 인덱스 찾기
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    if (accessoryCodeIdx === -1) {
      return { inUse: false, productCount: 0 };
    }
    
    // 사방넷 코드 열 인덱스 찾기
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    if (sabangCodeIdx === -1) {
      return { inUse: false, productCount: 0 };
    }
    
    // 해당 부자재 코드를 사용하는 제품들 찾기
    const usingProducts = new Set();
    rows.forEach(row => {
      if (row[accessoryCodeIdx] === accessoryCode) {
        usingProducts.add(row[sabangCodeIdx]);
      }
    });
    
    return {
      inUse: usingProducts.size > 0,
      productCount: usingProducts.size
    };
  } catch (error) {
    Logger.log("부자재 사용 확인 중 오류: " + error.toString());
    return { inUse: false, productCount: 0 };
  }
}

// 변경 내역 기록 (선택적 구현)
function recordChangeHistory(action, target, oldData, newData) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.CHANGE_HISTORY);
    
    if (!sheet) {
      Logger.log("변경 내역 시트를 찾을 수 없습니다.");
      return;
    }
    
    const timestamp = new Date();
    const user = Session.getActiveUser().getEmail();
    const oldDataStr = oldData ? JSON.stringify(oldData) : '';
    const newDataStr = newData ? JSON.stringify(newData) : '';
    
    // 새 행 추가
    sheet.appendRow([
      timestamp,
      user,
      action,
      target,
      oldDataStr,
      newDataStr
    ]);
    
  } catch (error) {
    Logger.log("변경 내역 기록 중 오류: " + error.toString());
  }
}

/**
 * 특정 제품에 부자재 정보 추가
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} accessoryCode - 부자재 코드
 * @param {Object} accessoryInfo - 부자재 정보 (수량 등)
 * @return {Object} 결과 객체
 */
function addProductAccessory(sabangCode, accessoryCode, accessoryInfo) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const accessoriesSheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    const masterSheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);
    
    if (!accessoriesSheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    
    if (!masterSheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }
    
    // 부자재 마스터에서 해당 부자재가 있는지 확인
    const masterResult = getMasterAccessoryByCode(accessoryCode);
    if (!masterResult.success) {
      return createResult(false, '부자재 마스터에서 해당 부자재를 찾을 수 없습니다: ' + accessoryCode);
    }
    
    // 부자재 정보 시트의 헤더 가져오기
    const headers = accessoriesSheet.getRange(1, 1, 1, accessoriesSheet.getLastColumn()).getValues()[0];
    
    // 사방넷 코드와 부자재 코드 열 인덱스 찾기
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    
    if (sabangCodeIdx === -1 || accessoryCodeIdx === -1) {
      return createResult(false, '필수 열을 찾을 수 없습니다.');
    }
    
    // 새 행 데이터 준비
    const newRowData = Array(headers.length).fill('');
    newRowData[sabangCodeIdx] = sabangCode;
    newRowData[accessoryCodeIdx] = accessoryCode;
    
    // 추가 부자재 정보 채우기
    Object.keys(accessoryInfo).forEach(key => {
      const idx = headers.indexOf(key);
      if (idx !== -1) {
        newRowData[idx] = accessoryInfo[key];
      }
    });
    
    // 마스터 정보에서 기본 정보 채우기 (이름 등)
    const masterAccessory = masterResult.accessory;
    Object.keys(masterAccessory).forEach(key => {
      // 부자재 코드는 이미 설정했으므로 제외하고, 사방넷 코드도 제외
      if (key !== '부자재코드' && key !== '사방넷코드') {
        const idx = headers.indexOf(key);
        if (idx !== -1 && !newRowData[idx]) {
          newRowData[idx] = masterAccessory[key];
        }
      }
    });
    
    // 시트에 새 행 추가
    accessoriesSheet.appendRow(newRowData);
    
    // 변경 내역 기록
    const newData = {};
    headers.forEach((header, idx) => {
      newData[header] = newRowData[idx];
    });
    recordChangeHistory('add', '부자재정보', null, newData);
    
    return createResult(true, "부자재 정보 추가 성공", { accessory: newData });
  } catch (error) {
    return createResult(false, "부자재 정보 추가 중 오류 발생: " + error.toString());
  }
}

/**
 * 제품의 부자재 정보 업데이트
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} accessoryCode - 부자재 코드
 * @param {Object} accessoryInfo - 업데이트할 부자재 정보
 * @return {Object} 결과 객체
 */
function updateProductAccessory(sabangCode, accessoryCode, accessoryInfo) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    
    if (!sheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 사방넷 코드와 부자재 코드 열 인덱스 찾기
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    
    if (sabangCodeIdx === -1 || accessoryCodeIdx === -1) {
      return createResult(false, '필수 열을 찾을 수 없습니다.');
    }
    
    // 해당 사방넷 코드와 부자재 코드를 가진 행 찾기
    const rowIndex = rows.findIndex(row => 
      row[sabangCodeIdx] === sabangCode && row[accessoryCodeIdx] === accessoryCode
    );
    
    if (rowIndex === -1) {
      return createResult(false, '해당 제품의 부자재 정보를 찾을 수 없습니다.');
    }
    
    // 기존 데이터 가져오기
    const oldData = {};
    headers.forEach((header, idx) => {
      oldData[header] = rows[rowIndex][idx];
    });
    
    // 새 데이터 준비 (기존 데이터 + 업데이트 데이터)
    const newData = { ...oldData };
    Object.keys(accessoryInfo).forEach(key => {
      if (headers.includes(key)) {
        newData[key] = accessoryInfo[key];
      }
    });
    
    // 업데이트 행 데이터 준비
    const updatedRowData = headers.map(header => {
      return newData[header] !== undefined ? newData[header] : '';
    });
    
    // 시트 업데이트 (행 인덱스는 0 기반이므로 +2를 해서 실제 행 번호로 변환)
    sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([updatedRowData]);
    
    // 변경 내역 기록
    recordChangeHistory('update', '부자재정보', oldData, newData);
    
    return createResult(true, "부자재 정보 업데이트 성공", { accessory: newData });
  } catch (error) {
    return createResult(false, "부자재 정보 업데이트 중 오류 발생: " + error.toString());
  }
}

/**
 * 제품의 부자재 정보 삭제
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} accessoryCode - 부자재 코드
 * @return {Object} 결과 객체
 */
function deleteProductAccessory(sabangCode, accessoryCode) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const sheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    
    if (!sheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);
    
    // 사방넷 코드와 부자재 코드 열 인덱스 찾기
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    const accessoryCodeIdx = headers.indexOf('부자재코드');
    
    if (sabangCodeIdx === -1 || accessoryCodeIdx === -1) {
      return createResult(false, '필수 열을 찾을 수 없습니다.');
    }
    
    // 해당 사방넷 코드와 부자재 코드를 가진 행 찾기
    const rowIndex = rows.findIndex(row => 
      row[sabangCodeIdx] === sabangCode && row[accessoryCodeIdx] === accessoryCode
    );
    
    if (rowIndex === -1) {
      return createResult(false, '해당 제품의 부자재 정보를 찾을 수 없습니다.');
    }
    
    // 삭제 전 데이터 저장
    const oldData = {};
    headers.forEach((header, idx) => {
      oldData[header] = rows[rowIndex][idx];
    });
    
    // 행 삭제 (행 인덱스는 0 기반이므로 +2를 해서 실제 행 번호로 변환)
    sheet.deleteRow(rowIndex + 2);
    
    // 변경 내역 기록
    recordChangeHistory('delete', '부자재정보', oldData, null);
    
    return createResult(true, "부자재 정보 삭제 성공");
  } catch (error) {
    return createResult(false, "부자재 정보 삭제 중 오류 발생: " + error.toString());
  }
}

// 히스토리 기록 함수 추가
/**
 * 제품 변경 히스토리 기록
 * @param {string} sabangCode - 사방넷 코드
 * @param {Array} oldData - 이전 데이터
 * @param {Array} newData - 새 데이터
 * @param {string} action - 수행된 액션 (add, update, delete)
 * @return {Object} 결과 객체
 */
function logProductHistory(sabangCode, oldData, newData, action) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    let historySheet = spreadsheet.getSheetByName(SHEET_NAMES.CHANGE_HISTORY);
    
    // 히스토리 시트가 없으면 생성
    if (!historySheet) {
      historySheet = createHistorySheet(spreadsheet);
    }
    
    // 현재 사용자 정보
    const currentUser = Session.getActiveUser().getEmail();
    const timestamp = new Date().toISOString();
    
    // 변경된 필드 찾기
    const headers = getAllProductData().headers;
    const changedFields = [];
    
    if (action === 'add') {
      // 새 제품 추가인 경우
      changedFields.push({
        field: '전체',
        oldValue: '',
        newValue: '새 제품 추가'
      });
    } else if (action === 'delete') {
      // 제품 삭제인 경우
      changedFields.push({
        field: '전체',
        oldValue: '제품 정보',
        newValue: '제품 삭제됨'
      });
    } else if (action === 'update') {
      // 업데이트인 경우 변경된 필드 비교
      for (let i = 0; i < headers.length; i++) {
        if (i < oldData.length && i < newData.length) {
          const oldValue = oldData[i];
          const newValue = newData[i];
          
          // 값을 문자열로 변환 후 앞뒤 공백을 제거하여 비교
          const normalizedOldValue = oldValue === null || oldValue === undefined ? '' : String(oldValue).trim();
          const normalizedNewValue = newValue === null || newValue === undefined ? '' : String(newValue).trim();

          // 정규화된 값이 다른 경우에만 기록
          if (normalizedOldValue !== normalizedNewValue) {
            changedFields.push({
              field: headers[i],
              oldValue: oldValue,
              newValue: newValue
            });
          }
        }
      }
    }
    
    // 변경 사항이 있는 경우만 기록
    if (changedFields.length > 0) {
      // 각 변경 필드별로 히스토리 레코드 생성
      changedFields.forEach(change => {
        const historyRecord = [
          timestamp,
          currentUser,
          sabangCode,
          action,
          change.field,
          change.oldValue,
          change.newValue
        ];
        
        historySheet.appendRow(historyRecord);
      });
    }
    
    return createResult(true, "히스토리가 기록되었습니다.");
  } catch (error) {
    Logger.log("히스토리 기록 오류: " + error.toString());
    return createResult(false, "히스토리 기록 중 오류 발생: " + error.toString());
  }
}

/**
 * 히스토리 시트 생성
 * @param {Spreadsheet} spreadsheet - 스프레드시트 객체
 * @return {Sheet} 생성된 시트 객체
 */
function createHistorySheet(spreadsheet) {
  const historySheet = spreadsheet.insertSheet(SHEET_NAMES.CHANGE_HISTORY);
  
  // 헤더 생성
  const headers = [
    'Timestamp', 'User', 'SabangCode', 'Action', 'Field', 'OldValue', 'NewValue'
  ];
  historySheet.appendRow(headers);
  
  // 헤더 스타일링
  const headerRange = historySheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#f3f3f3')
             .setFontWeight('bold')
             .setHorizontalAlignment('center');
  
  return historySheet;
}

/**
 * 제품의 변경 히스토리 가져오기
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체 - 히스토리 포함
 */
function getProductChangeHistory(sabangCode) {
  try {
    // 시작 시간 기록 (실행 시간 추적용)
    const startTime = new Date().getTime();
    Logger.log("히스토리 로드 시작: 사방넷 코드=" + sabangCode);
    
    const { spreadsheet } = getSpreadsheetAndSheet();
    const historySheet = spreadsheet.getSheetByName(SHEET_NAMES.CHANGE_HISTORY);
    
    if (!historySheet) {
      return createResult(true, "히스토리 데이터가 없습니다.", { history: [] });
    }
    
    // 히스토리 데이터 가져오기
    const dataRange = historySheet.getDataRange();
    const data = dataRange.getValues();
    Logger.log("데이터 로드 완료: " + (new Date().getTime() - startTime) + "ms, 행 수: " + data.length);
    
    if (data.length <= 1) {
      return createResult(true, "히스토리 데이터가 없습니다.", { history: [] });
    }
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 사방넷 코드 열 인덱스 찾기
    const sabangCodeIdx = headers.indexOf('SabangCode');
    if (sabangCodeIdx === -1) {
      return createResult(false, "히스토리 데이터 형식이 올바르지 않습니다.");
    }
    
    // 데이터양 제한 - 최근 100개 항목만 처리 (성능 최적화)
    const MAX_HISTORY_ITEMS = 100;
    
    // 해당 제품의 히스토리만 필터링
    Logger.log("필터링 시작: " + (new Date().getTime() - startTime) + "ms");
    const productHistory = rows
      .filter(row => row[sabangCodeIdx] === sabangCode)
      .slice(0, MAX_HISTORY_ITEMS * 2) // 필터링 전에 대략적으로 제한
      .map(row => {
        // 객체로 변환
        return headers.reduce((obj, header, idx) => {
          obj[header] = row[idx];
          return obj;
        }, {});
      })
      .sort((a, b) => {
        // 최신 순으로 정렬
        return new Date(b.Timestamp) - new Date(a.Timestamp);
      })
      .slice(0, MAX_HISTORY_ITEMS); // 최종 개수 제한
    
    Logger.log("처리 완료: " + (new Date().getTime() - startTime) + "ms, 항목 수: " + productHistory.length);
    return createResult(true, "히스토리 데이터를 가져왔습니다.", { history: productHistory });
  } catch (error) {
    Logger.log("히스토리 데이터 가져오기 오류: " + error.toString());
    Logger.log("오류 스택: " + (error.stack || "스택 정보 없음"));
    return createResult(false, "히스토리 데이터를 가져오는 중 오류 발생: " + error.toString());
  }
}

// =============== 문서 관리 함수 ===============


/**
 * 공유 드라이브 폴더 가져오기
 * @param {string} folderId - 폴더 ID
 * @return {Folder|null} 폴더 객체 또는 null
 */
function getSharedDriveFolder(folderId) {
  try {
    // DriveApp을 사용하여 공유 드라이브의 폴더 접근
    return DriveApp.getFolderById(folderId);
  } catch (error) {
    Logger.log(`폴더 접근 오류: ${error.toString()}`);
    return null;
  }
}

/**
 * 공유 드라이브 객체 가져오기
 * @return {DriveApp.Team|null} 공유 드라이브 객체 또는 null
 */
function getSharedDrive() {
  try {
    return DriveApp.getFolderById(SHARED_DRIVE_ID);
  } catch (error) {
    Logger.log(`공유 드라이브 접근 오류: ${error.toString()}`);
    return null;
  }
}

/**
 * 메인 폴더 가져오기 또는 생성하기 (공유 드라이브 버전)
 * @param {string} mainFolderName - 메인 폴더명, 기본값은 '제품 문서 저장소'
 * @return {Folder} 구글 드라이브 폴더 객체
 */
function getOrCreateMainFolder(mainFolderName = '제품 문서 저장소') {
  try {
    // 스크립트 프로퍼티에서 메인 폴더 ID 확인
    const mainFolderId = PropertiesService.getScriptProperties().getProperty('MAIN_FOLDER_ID');
    
    // 저장된 폴더 ID가 있으면 해당 폴더 반환
    if (mainFolderId) {
      try {
        const folder = DriveApp.getFolderById(mainFolderId);
        if (folder) {
          return folder;
        }
      } catch (e) {
        Logger.log("저장된 메인 폴더를 찾을 수 없음: " + e.toString());
      }
    }
    
    // SHARED_DRIVE_ID 자체를 폴더로 사용하거나 그 안에 새 폴더 생성
    const sharedDriveFolder = DriveApp.getFolderById(SHARED_DRIVE_ID);
    
    // 이미 존재하는 폴더 찾기
    const folderIterator = sharedDriveFolder.getFoldersByName(mainFolderName);
    
    if (folderIterator.hasNext()) {
      // 폴더가 이미 존재하면 ID 저장하고 반환
      const folder = folderIterator.next();
      PropertiesService.getScriptProperties().setProperty('MAIN_FOLDER_ID', folder.getId());
      return folder;
    }
    
    // 폴더가 없으면 새로 생성
    const newFolder = sharedDriveFolder.createFolder(mainFolderName);
    
    // 생성된 폴더 ID 저장
    PropertiesService.getScriptProperties().setProperty('MAIN_FOLDER_ID', newFolder.getId());
    
    Logger.log(`공유 드라이브에 메인 폴더 생성 완료: ${mainFolderName}, ID: ${newFolder.getId()}`);
    return newFolder;
  } catch (error) {
    Logger.log(`공유 드라이브 메인 폴더 생성 오류: ${error.toString()}`);
    throw new Error(DOCUMENT_ERROR_MESSAGES.FOLDER_CREATE_FAILED + error.toString());
  }
}

/**
 * 제품별 폴더 가져오기 또는 생성하기 (공유 드라이브 버전)
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체 - 폴더 ID와 URL 포함
 */
function getOrCreateProductFolder(sabangCode) {
  try {
    if (!sabangCode) {
      return createResult(false, DOCUMENT_ERROR_MESSAGES.INVALID_SABANG_CODE);
    }
    
    // 메인 폴더 가져오기
    const mainFolder = getOrCreateMainFolder();
    
    // 제품 폴더 찾기
    let productFolder = null;
    const folderIterator = mainFolder.getFoldersByName(sabangCode);
    
    if (folderIterator.hasNext()) {
      // 폴더가 이미 존재하면 반환
      productFolder = folderIterator.next();
    } else {
      // 폴더가 없으면 새로 생성
      productFolder = mainFolder.createFolder(sabangCode);
      Logger.log(`공유 드라이브에 제품 폴더 생성 완료: ${sabangCode}`);
    }
    
    // 결과 반환
    return createResult(true, '제품 폴더를 가져왔습니다.', {
      folderId: productFolder.getId(),
      folderUrl: productFolder.getUrl()
    });
  } catch (error) {
    Logger.log(`제품 폴더 가져오기/생성 오류: ${error.toString()}`);
    return createResult(false, DOCUMENT_ERROR_MESSAGES.FOLDER_CREATE_FAILED + error.toString());
  }
}

/**
 * 파일 업로드 함수 (공유 드라이브 버전)
 * @param {Blob} fileBlob - 업로드할 파일 Blob
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} documentType - 문서 유형
 * @param {string} fileName - 파일명 (선택적)
 * @return {Object} 결과 객체
 */
function uploadFile(fileBlob, sabangCode, documentType, fileName) {
  try {
    if (!fileBlob) {
      return createResult(false, DOCUMENT_ERROR_MESSAGES.NO_FILE_SELECTED);
    }
    
    // 제품 폴더 가져오기
    const folderResult = getOrCreateProductFolder(sabangCode);
    if (!folderResult.success) {
      return folderResult;
    }
    
    const folderId = folderResult.folderId;
    const folder = getSharedDriveFolder(folderId);
    
    // 파일명과 확장자 분리 처리
    let baseFileName;
    let extension = '';
    
    if (fileName) {
      const lastDotIndex = fileName.lastIndexOf('.');
      if (lastDotIndex !== -1) {
        // 파일명에서 확장자 분리
        baseFileName = fileName.substring(0, lastDotIndex);
        extension = fileName.substring(lastDotIndex);
      } else {
        // 확장자가 없는 경우
        baseFileName = fileName;
      }
    } else {
      // 파일명이 제공되지 않은 경우 문서 유형 + 타임스탬프 사용
      const timestamp = new Date().toISOString().replace(/[:\-\.]/g, '').slice(0, 14);
      const cleanedType = documentType.replace(/[\/\\:*?"<>|]/g, '_');
      baseFileName = `${cleanedType}_${timestamp}`;
    }
    
    // 확장자가 없는 경우 MIME 타입에 따라 추가
    if (!extension) {
      extension = getExtensionByMimeType(fileBlob.getContentType());
    }
    
    // 최종 파일명 결정
    const fullFileName = baseFileName + extension;
    
    // 기존 같은 유형의 파일이 있는지 확인
    const existingFiles = getDocumentsByType(sabangCode, documentType);
    
    // 같은 유형의 파일이 있으면 삭제 (최신 버전만 유지)
    if (existingFiles.success && existingFiles.files.length > 0) {
      existingFiles.files.forEach(file => {
        try {
          DriveApp.getFileById(file.id).setTrashed(true);
          Logger.log(`기존 파일 삭제: ${file.name}`);
        } catch (e) {
          Logger.log(`기존 파일 삭제 실패: ${e.toString()}`);
        }
      });
    }
    
    // 파일 업로드
    const file = folder.createFile(fileBlob);
    file.setName(fullFileName);
    
    // 문서 정보 시트에 기록
    updateDocumentInfo(sabangCode, documentType, file.getId(), file.getName(), file.getUrl());
    
    return createResult(true, '파일이 성공적으로 업로드되었습니다.', {
      fileId: file.getId(),
      fileName: file.getName(),
      fileUrl: file.getUrl()
    });
  } catch (error) {
    Logger.log(`파일 업로드 오류: ${error.toString()}`);
    return createResult(false, DOCUMENT_ERROR_MESSAGES.FILE_UPLOAD_FAILED + error.toString());
  }
}

/**
 * MIME 타입에 따른 확장자 반환
 * @param {string} mimeType - MIME 타입
 * @return {string} 파일 확장자
 */
function getExtensionByMimeType(mimeType) {
  const mimeToExt = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'text/plain': '.txt',
    'application/zip': '.zip'
  };
  
  return mimeToExt[mimeType] || '';
}

/**
 * 서류 정보 시트 가져오기 또는 생성하기
 * @return {Sheet} 서류 정보 시트
 */
function getOrCreateDocumentSheet() {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    let docSheet = spreadsheet.getSheetByName(SHEET_NAMES.DOCUMENT_INFO);
    
    if (!docSheet) {
      // 시트가 없으면 새로 생성
      docSheet = spreadsheet.insertSheet(SHEET_NAMES.DOCUMENT_INFO);
      
      // 헤더 추가
      const headers = ['사방넷코드', '문서유형', '파일ID', '파일명', '파일URL', '업로드일시', '업로드자'];
      docSheet.appendRow(headers);
      
      // 헤더 서식 설정
      const headerRange = docSheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#f3f3f3')
                 .setFontWeight('bold')
                 .setHorizontalAlignment('center');
      
      // 열 너비 자동 조정
      docSheet.autoResizeColumns(1, headers.length);
      
      // 첫 번째 행 고정
      docSheet.setFrozenRows(1);
      
      Logger.log('서류 정보 시트 생성 완료');
    }
    
    return docSheet;
  } catch (error) {
    Logger.log(`서류 정보 시트 가져오기/생성 오류: ${error.toString()}`);
    throw new Error(DOCUMENT_ERROR_MESSAGES.NO_DOCUMENT_SHEET);
  }
}

/**
 * 문서 정보 업데이트
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} documentType - 문서 유형
 * @param {string} fileId - 파일 ID
 * @param {string} fileName - 파일명
 * @param {string} fileUrl - 파일 URL
 * @return {boolean} 성공 여부
 */
function updateDocumentInfo(sabangCode, documentType, fileId, fileName, fileUrl) {
  try {
    const docSheet = getOrCreateDocumentSheet();
    const uploadTime = new Date().toISOString();
    const uploader = Session.getActiveUser().getEmail();
    
    // 기존 같은 유형의 문서 정보 행 찾기
    const dataRange = docSheet.getDataRange();
    const values = dataRange.getValues();
    let existingRowIndex = -1;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === sabangCode && values[i][1] === documentType) {
        existingRowIndex = i + 1; // 시트 인덱스는 1부터 시작
        break;
      }
    }
    
    if (existingRowIndex > 0) {
      // 기존 항목 업데이트
      docSheet.getRange(existingRowIndex, 3).setValue(fileId);
      docSheet.getRange(existingRowIndex, 4).setValue(fileName);
      docSheet.getRange(existingRowIndex, 5).setValue(fileUrl);
      docSheet.getRange(existingRowIndex, 6).setValue(uploadTime);
      docSheet.getRange(existingRowIndex, 7).setValue(uploader);
    } else {
      // 새 행 추가
      docSheet.appendRow([sabangCode, documentType, fileId, fileName, fileUrl, uploadTime, uploader]);
    }
    
    return true;
  } catch (error) {
    Logger.log(`문서 정보 업데이트 오류: ${error.toString()}`);
    return false;
  }
}

/**
 * 특정 제품의 모든 문서 정보 가져오기
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체
 */
function getDocumentsByProduct(sabangCode) {
  try {
    const docSheet = getOrCreateDocumentSheet();
    const dataRange = docSheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    
    // 사방넷 코드에 해당하는 문서 정보 필터링
    const documents = [];
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === sabangCode) {
        // 행 데이터를 객체로 변환
        const doc = {};
        headers.forEach((header, index) => {
          doc[header] = values[i][index];
        });
        documents.push(doc);
      }
    }
    
    return createResult(true, `${documents.length}개의 문서를 찾았습니다.`, {
      documents: documents
    });
  } catch (error) {
    Logger.log(`문서 정보 가져오기 오류: ${error.toString()}`);
    return createResult(false, '문서 정보를 가져오는 중 오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * 특정 유형의 문서 가져오기 (공유 드라이브 버전)
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} documentType - 문서 유형
 * @return {Object} 결과 객체
 */
function getDocumentsByType(sabangCode, documentType) {
  try {
    // 제품 폴더 확인
    const folderResult = getOrCreateProductFolder(sabangCode);
    if (!folderResult.success) {
      return folderResult;
    }
    
    const folderId = folderResult.folderId;
    const folder = getSharedDriveFolder(folderId);
    
    if (!folder) {
      return createResult(false, '폴더를 찾을 수 없습니다.');
    }
    
    // 파일 목록 가져오기
    const files = [];
    const fileIterator = folder.getFiles();
    
    while (fileIterator.hasNext()) {
      const file = fileIterator.next();
      const fileName = file.getName();
      
      // 문서 유형과 일치하는 파일 찾기
      if (fileName.startsWith(documentType) || fileName.includes(documentType)) {
        files.push({
          id: file.getId(),
          name: fileName,
          url: file.getUrl(),
          date: file.getLastUpdated()
        });
      }
    }
    
    return createResult(true, `${files.length}개의 ${documentType} 문서를 찾았습니다.`, {
      files: files
    });
  } catch (error) {
    Logger.log(`특정 유형 문서 가져오기 오류: ${error.toString()}`);
    return createResult(false, '문서를 가져오는 중 오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * 문서 다운로드 URL 가져오기 (공유 드라이브 버전)
 * @param {string} fileId - 파일 ID
 * @return {Object} 결과 객체
 */
function getDocumentDownloadUrl(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    const downloadUrl = file.getDownloadUrl();
    
    return createResult(true, '다운로드 URL을 생성했습니다.', {
      downloadUrl: downloadUrl,
      fileName: file.getName()
    });
  } catch (error) {
    Logger.log(`문서 다운로드 URL 생성 오류: ${error.toString()}`);
    return createResult(false, DOCUMENT_ERROR_MESSAGES.FILE_DOWNLOAD_FAILED + error.toString());
  }
}

/**
 * 공유 드라이브 폴더 URL 가져오기
 * @param {string} sabangCode - 사방넷 코드 
 * @return {Object} 결과 객체 - 공유 드라이브 폴더 URL 포함
 */
function getProductFolderUrl(sabangCode) {
  try {
    const folderResult = getOrCreateProductFolder(sabangCode);
    if (!folderResult.success) {
      return folderResult;
    }
    
    return createResult(true, '폴더 URL을 가져왔습니다.', {
      folderUrl: folderResult.folderUrl
    });
  } catch (error) {
    return createResult(false, '폴더 URL을 가져오는 중 오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * 문서 유형 목록 가져오기
 * @return {Object} 결과 객체
 */
function getDocumentTypes() {
  try {
    // 문서 유형 관리 시트가 있는지 확인
    const { spreadsheet } = getSpreadsheetAndSheet();
    const docTypeSheet = spreadsheet.getSheetByName('문서유형관리');
    
    let documentTypes = [...DEFAULT_DOCUMENT_TYPES]; // 기본값으로 초기화
    
    if (docTypeSheet) {
      // 시트에서 문서 유형 목록 가져오기
      const dataRange = docTypeSheet.getDataRange();
      const values = dataRange.getValues();
      
      if (values.length > 1) {
        // 헤더를 제외한 데이터 행에서 문서 유형 추출
        documentTypes = values.slice(1).map(row => row[0]).filter(Boolean);
      }
    } else {
      // 문서 유형 관리 시트 생성 및 기본 유형 저장
      createDocumentTypesSheet(spreadsheet, documentTypes);
    }
    
    return createResult(true, `${documentTypes.length}개의 문서 유형을 가져왔습니다.`, {
      documentTypes: documentTypes
    });
  } catch (error) {
    Logger.log(`문서 유형 목록 가져오기 오류: ${error.toString()}`);
    return createResult(false, '문서 유형 목록을 가져오는 중 오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * 문서 유형 관리 시트 생성
 * @param {Spreadsheet} spreadsheet - 스프레드시트 객체
 * @param {Array} documentTypes - 문서 유형 목록
 * @return {Sheet} 생성된 시트
 */
function createDocumentTypesSheet(spreadsheet, documentTypes) {
  // 시트 생성
  const sheet = spreadsheet.insertSheet('문서유형관리');
  
  // 헤더 추가
  sheet.appendRow(['문서유형', '설명', '필수여부', '순서']);
  
  // 헤더 스타일 설정
  const headerRange = sheet.getRange(1, 1, 1, 4);
  headerRange.setBackground('#f3f3f3')
             .setFontWeight('bold')
             .setHorizontalAlignment('center');
  
  // 문서 유형 데이터 추가
  const rows = documentTypes.map((type, index) => [type, '', false, index + 1]);
  
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }
  
  // 열 너비 조정
  sheet.setColumnWidth(1, 300);
  sheet.setColumnWidth(2, 200);
  sheet.autoResizeColumns(3, 2);
  
  // 첫 번째 행 고정
  sheet.setFrozenRows(1);
  
  Logger.log('문서 유형 관리 시트 생성 완료');
  return sheet;
}

/**
 * 문서 유형 추가
 * @param {string} documentType - 추가할 문서 유형
 * @param {string} description - 설명 (선택적)
 * @param {boolean} required - 필수 여부 (선택적)
 * @return {Object} 결과 객체
 */
function addDocumentType(documentType, description = '', required = false) {
  try {
    if (!documentType) {
      return createResult(false, '문서 유형을 입력하세요.');
    }
    
    const { spreadsheet } = getSpreadsheetAndSheet();
    let docTypeSheet = spreadsheet.getSheetByName('문서유형관리');
    
    if (!docTypeSheet) {
      // 시트가 없으면 생성
      docTypeSheet = createDocumentTypesSheet(spreadsheet, DEFAULT_DOCUMENT_TYPES);
    }
    
    // 기존 문서 유형 목록 가져오기
    const dataRange = docTypeSheet.getDataRange();
    const values = dataRange.getValues();
    const types = values.slice(1).map(row => row[0]);
    
    // 이미 존재하는 유형인지 확인
    if (types.includes(documentType)) {
      return createResult(false, `이미 존재하는 문서 유형입니다: ${documentType}`);
    }
    
    // 새 순서 번호 계산
    const newOrder = types.length + 1;
    
    // 새 문서 유형 추가
    docTypeSheet.appendRow([documentType, description, required, newOrder]);
    
    return createResult(true, `새 문서 유형이 추가되었습니다: ${documentType}`);
  } catch (error) {
    Logger.log(`문서 유형 추가 오류: ${error.toString()}`);
    return createResult(false, '문서 유형을 추가하는 중 오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * 문서 유형 삭제
 * @param {string} documentType - 삭제할 문서 유형
 * @return {Object} 결과 객체
 */
function deleteDocumentType(documentType) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const docTypeSheet = spreadsheet.getSheetByName('문서유형관리');
    
    if (!docTypeSheet) {
      return createResult(false, '문서 유형 관리 시트를 찾을 수 없습니다.');
    }
    
    // 문서 유형 찾기
    const dataRange = docTypeSheet.getDataRange();
    const values = dataRange.getValues();
    let typeRowIndex = -1;
    
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === documentType) {
        typeRowIndex = i + 1; // 시트 인덱스는 1부터 시작
        break;
      }
    }
    
    if (typeRowIndex === -1) {
      return createResult(false, `문서 유형을 찾을 수 없습니다: ${documentType}`);
    }
    
    // 문서 유형 삭제
    docTypeSheet.deleteRow(typeRowIndex);
    
    return createResult(true, `문서 유형이 삭제되었습니다: ${documentType}`);
  } catch (error) {
    Logger.log(`문서 유형 삭제 오류: ${error.toString()}`);
    return createResult(false, '문서 유형을 삭제하는 중 오류가 발생했습니다: ' + error.toString());
  }
}

/**
 * 클라이언트가 업로드 요청 시 호출되는 함수 (Apps Script)
 * 
 * @param {string} sabangCode      - 사방넷 코드
 * @param {string} documentType    - 문서 유형 (예: '완제품 SDS')
 * @param {string} fileName        - 업로드할 파일명 (예: 'test1.xlsx')
 * @param {string} possiblyEncodedBase64 - 순수 Base64 또는 URL인코딩된 Base64, 
 *                                         혹은 "data:...;base64,..." 형태의 Data URL
 * @return {Object} { success: boolean, message: string }
 */
function uploadDocumentFile(sabangCode, documentType, fileName, possiblyEncodedBase64) {
  try {
    // 1) 기본 검증
    if (!sabangCode) {
      return createResult(false, '사방넷 코드가 유효하지 않습니다.');
    }
    if (!documentType) {
      return createResult(false, '문서 유형이 지정되지 않았습니다.');
    }
    if (!possiblyEncodedBase64) {
      return createResult(false, '업로드할 파일이 존재하지 않습니다.');
    }

    // 2) 우선 decodeURIComponent 시도: 
    //    만약 이미 '%2B', '%2F' 등이 포함되어 있으면 여기서 '+' '/' 등으로 복원됨
    var rawBase64;
    try {
      rawBase64 = decodeURIComponent(possiblyEncodedBase64);
    } catch (e) {
      // decodeURIComponent가 실패한다면, 아마 원본이 URL 인코딩이 아닌 순수 문자열일 수 있음
      // fallback: 그대로 사용
      rawBase64 = possiblyEncodedBase64;
    }

    // 3) dataURL( ex: "data:application/pdf;base64,JVBERi0xLj..." ) 파싱
    //    정규식으로 MIME, base64 파트 분리
    var dataUrlMatches = rawBase64.match(/^data:([A-Za-z0-9+\-\/]+);base64,(.+)$/);
    
    var mimeType, base64Part;
    if (dataUrlMatches) {
      // data URL 형식
      mimeType = dataUrlMatches[1];       // 예) "application/pdf"
      base64Part = dataUrlMatches[2];    // 실제 base64
    } else {
      // data URL이 아니라면, 순수 Base64 문자열로 가정
      base64Part = rawBase64;
      // 파일 확장자를 보고 MIME 추정 (필요시 PDF/JPG/PNG/XLSX/DOCX 등 추가)
      mimeType = guessMimeTypeByExtension(fileName);
    }

    // 4) Base64 디코딩
    var decodedBytes = Utilities.base64Decode(base64Part);

    // 5) Blob 생성 (파일명에 특수문자/한글이 있을 경우 환경에 따라 깨질 수도 있음)
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // 6) 실제 파일 업로드 처리 (DriveApp 등)
    //    예: uploadFile(blob, sabangCode, documentType, fileName);
    //    아래는 가정된 함수
    var result = uploadFile(blob, sabangCode, documentType, fileName);

    // 성공시
    return createResult(true, '업로드가 완료되었습니다: ' + result.fileId);

  } catch (error) {
    Logger.log('[uploadDocumentFile] 오류: ' + error);
    return createResult(false, '파일 업로드에 실패했습니다: ' + error);
  }
}

/**
 * 확장자를 보고 MIME을 유추하는 간단 예시 함수
 * @param {string} fileName
 * @return {string} MIME type (기본값 "application/octet-stream")
 */
function guessMimeTypeByExtension(fileName) {
  // 소문자로 확장자 추출
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    // 필요시 더 추가
    default:
      return 'application/octet-stream';
  }
}

/**
 * 제품 편집을 위한 잠금 설정
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} userEmail - 사용자 이메일
 * @return {Object} 결과 객체
 */
function lockProductForEditing(sabangCode) {
  try {
    // 서버에서 직접 사용자 이메일 가져오기
    const userEmail = Session.getActiveUser().getEmail();
    
    // 현재 잠금 상태 확인
    const lockInfo = checkProductLock(sabangCode);
    if (!lockInfo.success && !lockInfo.expired) {
      return lockInfo; // 이미 다른 사용자가 잠금 설정
    }
    
    // 잠금 정보 설정
    const now = new Date().getTime();
    const lockExpirationTime = now + (5 * 60 * 1000); // 5분 잠금
    
    const lockData = {
      user: userEmail,
      timestamp: now,
      expiration: lockExpirationTime
    };
    
    // 잠금 정보 저장 (캐시)
    CacheUtil.set(`lock_${sabangCode}`, lockData);
    
    Logger.log(`제품 ${sabangCode} 잠금 설정 완료: ${userEmail}`);
    return createResult(true, `제품이 편집을 위해 잠겼습니다. (${new Date(lockExpirationTime).toLocaleTimeString()}까지)`, {
      lockExpiration: lockExpirationTime
    });
  } catch (error) {
    Logger.log("제품 잠금 설정 오류: " + error.toString());
    return createResult(false, "제품 잠금 설정 중 오류가 발생했습니다: " + error.toString());
  }
}

/**
 * 제품 잠금 확인
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체
 */
function checkProductLock(sabangCode) {
  try {
    const lock = CacheUtil.get(`lock_${sabangCode}`);
    
    if (!lock) {
      return createResult(true, "제품을 편집할 수 있습니다.");
    }
    
    const now = new Date().getTime();
    if (now > lock.expiration) {
      // 잠금 시간 초과 - 잠금 해제
      CacheUtil.remove(`lock_${sabangCode}`);
      return createResult(true, "제품을 편집할 수 있습니다.", { expired: true });
    }
    
    // 잠금 상태 - 편집 불가
    const remainingTime = Math.round((lock.expiration - now) / 1000 / 60);
    return createResult(false, `이 제품은 현재 ${lock.user}님이 편집 중입니다. (약 ${remainingTime}분 후 자동 해제)`, {
      lockedBy: lock.user,
      lockExpiration: lock.expiration,
      expired: false
    });
  } catch (error) {
    Logger.log("제품 잠금 확인 오류: " + error.toString());
    return createResult(true, "제품 잠금 확인 중 오류가 발생했습니다. 안전을 위해 편집을 허용합니다.");
  }
}

/**
 * 제품 잠금 해제
 * @param {string} sabangCode - 사방넷 코드
 * @param {string} [userEmail] - 사용자 이메일 (선택적 - 잠금 설정자 확인용)
 * @return {Object} 결과 객체
 */
function unlockProduct(sabangCode) {
  try {
    // 서버에서 직접 사용자 이메일 가져오기
    const userEmail = Session.getActiveUser().getEmail();
    
    if (!sabangCode) {
      return createResult(false, "잠금 해제할 제품 코드가 제공되지 않았습니다.");
    }
    
    const lock = CacheUtil.get(`lock_${sabangCode}`);
    
    // 이미 잠금이 해제되었거나 없는 경우
    if (!lock) {
      return createResult(true, "제품 잠금이 해제되었습니다.");
    }
    
    // 잠금 설정자 확인 (선택적)
    if (lock.user !== userEmail) {
      return createResult(false, "다른 사용자가 잠근 제품은 해제할 수 없습니다.");
    }
    
    // 잠금 해제
    CacheUtil.remove(`lock_${sabangCode}`);
    Logger.log(`제품 ${sabangCode} 잠금 해제 완료`);
    
    return createResult(true, "제품 잠금이 해제되었습니다.");
  } catch (error) {
    Logger.log("제품 잠금 해제 오류: " + error.toString());
    return createResult(false, "제품 잠금 해제 중 오류가 발생했습니다: " + error.toString());
  }
}

/**
 * 최근 업데이트된 제품 목록 조회
 * @param {number} since - 이 시간 이후 변경된 제품만 조회 (밀리초)
 * @return {Object} 결과 객체 - 제품 코드별 타임스탬프 맵
 */
function getLastUpdatedTimestamps(since) {
  try {
    const { sheet } = getSpreadsheetAndSheet(SHEET_NAMES.PRODUCT_DATA);
    
    // 데이터를 한 번에 가져오기
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    
    const headers = data[0];
    const rows = data.slice(1);
    
    // 사방넷 코드 열 인덱스 찾기
    const sabangCodeIdx = headers.indexOf('사방넷코드');
    if (sabangCodeIdx === -1) {
      return createResult(false, ERROR_MESSAGES.SABANGNET_COLUMN_NOT_FOUND);
    }
    
    // 타임스탬프 열 인덱스 (마지막 열)
    const timestampIdx = headers.length - 1;
    
    // 지정된 시간 이후 업데이트된 제품만 필터링
    const timestamps = {};
    rows.forEach(row => {
      const sabangCode = row[sabangCodeIdx];
      const timestamp = row[timestampIdx];
      
      if (sabangCode && timestamp && (!since || timestamp > since)) {
        timestamps[sabangCode] = timestamp;
      }
    });
    
    return createResult(true, "최근 업데이트 시간 조회 성공", { timestamps });
  } catch (error) {
    Logger.log("업데이트 시간 조회 오류: " + error.toString());
    return createResult(false, "업데이트 시간 조회 중 오류가 발생했습니다: " + error.toString());
  }
}

// 확장 API 함수들
function getDocumentsByProductAPI(sabangCode) {
  return getDocumentsByProduct(sabangCode);
}

function getDocumentTypesAPI() {
  return getDocumentTypes();
}

function addDocumentTypeAPI(documentType, description, required) {
  return addDocumentType(documentType, description, required);
}

function deleteDocumentTypeAPI(documentType) {
  return deleteDocumentType(documentType);
}

function getDocumentDownloadUrlAPI(fileId) {
  return getDocumentDownloadUrl(fileId);
}

/**
 * 특정 부자재에 연결된 제품 목록을 업데이트합니다. (기존 연결 삭제 후 새로 추가, 이름 정보 포함)
 * @param {string} accessoryCode 업데이트할 부자재 코드
 * @param {string[]} productSabangCodes 새로 매핑할 제품 사방넷 코드 배열
 * @returns {object} 성공 여부 및 메시지
 */
function updateAccessoryProductMappings(accessoryCode, productSabangCodes) {
  if (!accessoryCode || !Array.isArray(productSabangCodes)) {
    return { success: false, message: '부자재 코드 또는 제품 코드 목록이 유효하지 않습니다.' };
  }

  let lock; // lock 변수를 try 블록 외부에서 선언

  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000); // 최대 30초 대기

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const accessoryInfoSheet = ss.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    const productSheet = ss.getSheetByName(SHEET_NAMES.PRODUCT_DATA);
    const accessoryMasterSheet = ss.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);

    if (!accessoryInfoSheet) throw new Error(`시트 '${SHEET_NAMES.ACCESSORIES_DATA}'를 찾을 수 없습니다.`);
    if (!productSheet) throw new Error(`시트 '${SHEET_NAMES.PRODUCT_DATA}'를 찾을 수 없습니다.`);
    if (!accessoryMasterSheet) throw new Error(`시트 '${SHEET_NAMES.ACCESSORIES_MASTER}'를 찾을 수 없습니다.`);

    // --- 데이터 및 헤더 인덱스 가져오기 ---
    // 부자재 정보 시트
    const infoData = accessoryInfoSheet.getDataRange().getValues();
    const infoHeaders = infoData[0];
    const infoAccCodeCol = infoHeaders.indexOf('부자재코드');
    const infoSabangCodeCol = infoHeaders.indexOf('사방넷코드');
    const infoAccNameCol = infoHeaders.indexOf('부자재명(한)'); // 부자재명 컬럼 추가
    const infoProdNameCol = infoHeaders.indexOf('상세제품명(한)'); // 제품명 컬럼 추가

    if (infoAccCodeCol === -1 || infoSabangCodeCol === -1 || infoAccNameCol === -1 || infoProdNameCol === -1) {
       throw new Error(`'부자재코드', '사방넷코드', '부자재명(한)', '상세제품명(한)' 헤더를 '${SHEET_NAMES.ACCESSORIES_DATA}' 시트에서 모두 찾아야 합니다.`);
    }

    // 부자재 마스터 시트 (부자재명 조회용)
    const masterData = accessoryMasterSheet.getDataRange().getValues();
    const masterHeaders = masterData[0];
    const masterAccCodeCol = masterHeaders.indexOf('부자재코드');
    const masterAccNameCol = masterHeaders.indexOf('부자재명(한)');
    let accessoryName = ''; // 부자재명 저장 변수
    if (masterAccCodeCol !== -1 && masterAccNameCol !== -1) {
      const masterRow = masterData.slice(1).find(row => row[masterAccCodeCol] === accessoryCode);
      if (masterRow) {
        accessoryName = masterRow[masterAccNameCol];
      } else {
         Logger.log(`'${SHEET_NAMES.ACCESSORIES_MASTER}' 시트에서 부자재 코드 '${accessoryCode}'를 찾을 수 없습니다.`);
         // 부자재명을 찾지 못해도 일단 진행 (필요시 오류 처리)
      }
    } else {
      Logger.log(`'${SHEET_NAMES.ACCESSORIES_MASTER}' 시트에서 '부자재코드' 또는 '부자재명(한)' 헤더를 찾을 수 없습니다.`);
    }


    // 제품 정보 시트 (제품명 조회용 맵 생성)
    const productData = productSheet.getDataRange().getValues();
    const productHeaders = productData[0];
    const prodSabangCodeCol = productHeaders.indexOf('사방넷코드');
    // 제품명 컬럼 우선순위: '상세제품명(한)' -> '제품명_발주점검시트'
    let prodNameCol = productHeaders.indexOf('상세제품명(한)');
    if (prodNameCol === -1) {
        prodNameCol = productHeaders.indexOf('제품명_발주점검시트');
    }

    const productNameMap = {};
    if (prodSabangCodeCol !== -1 && prodNameCol !== -1) {
      productData.slice(1).forEach(row => {
        productNameMap[row[prodSabangCodeCol]] = row[prodNameCol];
      });
    } else {
      Logger.log(`'${SHEET_NAMES.PRODUCT_DATA}' 시트에서 '사방넷코드' 또는 제품명 관련 헤더('상세제품명(한)', '제품명_발주점검시트')를 찾을 수 없습니다.`);
    }

    // --- 기존 행 삭제 ---
    const rowsToDelete = [];
    // data.length 가 1이면 헤더만 있는 경우이므로 삭제 로직 건너뛰기
    if (infoData.length > 1) {
      for (let i = 1; i < infoData.length; i++) {
        if (infoData[i][infoAccCodeCol] === accessoryCode) {
          rowsToDelete.push(i + 1);
        }
      }

      if (rowsToDelete.length > 0) {
          Logger.log(`${accessoryCode}에 대한 기존 매핑 ${rowsToDelete.length}개 삭제 시작`);
          for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            accessoryInfoSheet.deleteRow(rowsToDelete[i]);
            Utilities.sleep(50);
          }
          Logger.log(`${accessoryCode}에 대한 기존 매핑 삭제 완료`);
      }
    } else {
        Logger.log(`'${SHEET_NAMES.ACCESSORIES_DATA}' 시트에 데이터가 없습니다. 삭제 건너뛰기.`);
    }


    // --- 새로운 매핑 정보 추가 ---
    const newRows = productSabangCodes.map(sabangCode => {
      const newRow = new Array(infoHeaders.length).fill('');
      newRow[infoAccCodeCol] = accessoryCode;
      newRow[infoSabangCodeCol] = sabangCode;
      newRow[infoAccNameCol] = accessoryName; // 조회한 부자재명 추가
      newRow[infoProdNameCol] = productNameMap[sabangCode] || ''; // 조회한 제품명 추가, 없으면 빈 문자열
      return newRow;
    });

    if (newRows.length > 0) {
      accessoryInfoSheet.getRange(accessoryInfoSheet.getLastRow() + 1, 1, newRows.length, infoHeaders.length)
                      .setValues(newRows);
    }

    lock.releaseLock();
    Logger.log(`부자재-제품 매핑 업데이트: 부자재 코드 '${accessoryCode}', 제품 ${productSabangCodes.length}개`);
    return { success: true, message: '부자재-제품 매핑이 성공적으로 업데이트되었습니다.' };

  } catch (e) {
    Logger.log(`updateAccessoryProductMappings 오류: ${e.stack}`); // 오류 스택 트레이스 로깅
    if (lock) { // lock 객체가 할당되었는지 확인 후 해제 시도
        try { lock.releaseLock(); } catch (err) { Logger.log(`락 해제 실패: ${err}`); }
    }
    return { success: false, message: `매핑 업데이트 중 오류 발생: ${e.message}` };
  }
}

/**
 * 사방넷 코드로 부자재 데이터 가져오기 (수량 정보 포함)
 * @param {string} sabangCode - 사방넷 코드
 * @return {Object} 결과 객체
 */
function getAccessoriesBySabangCode(sabangCode) {
  try {
    const { spreadsheet } = getSpreadsheetAndSheet();
    const accessoriesSheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    const masterSheet = spreadsheet.getSheetByName(SHEET_NAMES.ACCESSORIES_MASTER);

    if (!accessoriesSheet) {
      return createResult(false, '부자재 정보 시트를 찾을 수 없습니다.');
    }
    if (!masterSheet) {
      return createResult(false, '부자재 마스터 시트를 찾을 수 없습니다.');
    }

    // 부자재 정보 시트 데이터 및 헤더 가져오기
    const accessoriesData = accessoriesSheet.getDataRange().getValues();
    const accessoriesHeaders = accessoriesData[0];
    const accessoriesRows = accessoriesData.slice(1);

    // 필수 컬럼 인덱스 찾기
    const sabangCodeIdx = accessoriesHeaders.indexOf('사방넷코드');
    const accessoryCodeIdx = accessoriesHeaders.indexOf('부자재코드');
    const quantityIdx = accessoriesHeaders.indexOf('수량'); // '수량' 컬럼 인덱스 찾기

    if (sabangCodeIdx === -1 || accessoryCodeIdx === -1) {
      return createResult(false, '\'사방넷코드\' 또는 \'부자재코드\' 열을 찾을 수 없습니다.');
    }
    // '수량' 컬럼이 없으면 오류 대신 경고 로깅 (하위 호환성)
    if (quantityIdx === -1) {
        Logger.log(`경고: '${SHEET_NAMES.ACCESSORIES_DATA}' 시트에 '수량' 컬럼이 없습니다. 수량 정보가 반환되지 않습니다.`);
    }

    // 해당 사방넷 코드를 가진 행들 필터링
    const filteredRows = accessoriesRows.filter(row => row[sabangCodeIdx] === sabangCode);

    if (filteredRows.length === 0) {
      return createResult(true, "해당 제품의 부자재 정보가 없습니다.", { headers: accessoriesHeaders, data: [] });
    }

    // 부자재 마스터 시트 데이터 가져오기 (이름 조회용 맵 생성)
    const masterData = masterSheet.getDataRange().getValues();
    const masterHeaders = masterData[0];
    const masterAccCodeIdx = masterHeaders.indexOf('부자재코드');
    const masterAccNameIdx = masterHeaders.indexOf('부자재명(한)');
    const accessoryNameMap = {};
    if (masterAccCodeIdx !== -1 && masterAccNameIdx !== -1) {
        masterData.slice(1).forEach(row => {
            accessoryNameMap[row[masterAccCodeIdx]] = row[masterAccNameIdx];
        });
    }

    // 최종 결과 데이터 생성 (수량 포함)
    const resultData = filteredRows.map(row => {
        const accessoryCode = row[accessoryCodeIdx];
        const accessoryName = accessoryNameMap[accessoryCode] || '';
        const quantity = quantityIdx !== -1 ? (row[quantityIdx] || 0) : 0; // 수량 컬럼이 있으면 값을 가져오고, 없으면 0
        
        // 클라이언트에 필요한 정보만 포함하는 객체 반환 (예시)
        // 필요에 따라 반환되는 데이터 구조 조정 가능
        return {
            '부자재코드': accessoryCode,
            '부자재명(한)': accessoryName, // 마스터에서 가져온 이름
            '수량': quantity
            // 필요하다면 부자재 정보 시트의 다른 컬럼도 여기에 추가
        };
    });

    // 클라이언트에 전달할 헤더 정의 (반환되는 객체 키와 일치)
    const resultHeaders = ['부자재코드', '부자재명(한)', '수량'];

    return createResult(true, "부자재 조회 성공", { headers: resultHeaders, data: resultData });
  } catch (error) {
    Logger.log(`getAccessoriesBySabangCode 오류: ${error.stack}`);
    return createResult(false, `부자재 정보를 가져오는 중 오류 발생: ${error.message}`);
  }
}

/**
 * 특정 제품의 부자재 수량을 업데이트합니다.
 * @param {string} sabangCode 사방넷 코드
 * @param {string} accessoryCode 부자재 코드
 * @param {number} quantity 새로운 수량
 * @returns {object} 성공 여부 및 메시지
 */
function updateProductAccessoryQuantity(sabangCode, accessoryCode, quantity) {
  if (!sabangCode || !accessoryCode || quantity === undefined || quantity === null || isNaN(Number(quantity))) {
    return { success: false, message: '사방넷코드, 부자재코드 또는 수량이 유효하지 않습니다.' };
  }

  const numericQuantity = Number(quantity);
  if (numericQuantity < 0) {
    return { success: false, message: '수량은 0 이상이어야 합니다.' };
  }

  let lock;
  try {
    lock = LockService.getScriptLock();
    lock.waitLock(30000); // 30초 대기

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAMES.ACCESSORIES_DATA);
    if (!sheet) {
      throw new Error(`시트 '${SHEET_NAMES.ACCESSORIES_DATA}'를 찾을 수 없습니다.`);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 필수 컬럼 인덱스 찾기
    const sabangCodeCol = headers.indexOf('사방넷코드');
    const accessoryCodeCol = headers.indexOf('부자재코드');
    let quantityCol = headers.indexOf('수량'); // let으로 변경하여 재할당 가능하게 함

    if (sabangCodeCol === -1 || accessoryCodeCol === -1) {
      throw new Error(`'사방넷코드' 또는 '부자재코드' 헤더를 '${SHEET_NAMES.ACCESSORIES_DATA}' 시트에서 찾을 수 없습니다.`);
    }
    if (quantityCol === -1) {
      // 수량 컬럼이 없으면 새로 추가 시도
      sheet.insertColumnAfter(headers.length);
      sheet.getRange(1, headers.length + 1).setValue('수량');
      quantityCol = headers.length; // 새 인덱스
      Logger.log(`'${SHEET_NAMES.ACCESSORIES_DATA}' 시트에 '수량' 컬럼을 추가했습니다.`);
      // 컬럼 추가 후 헤더 정보 갱신
      headers.push('수량'); 
    }

    // 해당 행 찾기
    let targetRowIndex = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][sabangCodeCol] === sabangCode && data[i][accessoryCodeCol] === accessoryCode) {
        targetRowIndex = i + 1; // 1-based index
        break;
      }
    }

    if (targetRowIndex === -1) {
      // 행을 찾지 못한 경우, updateAccessoryProductMappings를 통해 추가될 때 수량이 기록될 것으로 가정하고 오류 대신 로그만 남김
      Logger.log(`경고: 사방넷코드 '${sabangCode}' 및 부자재코드 '${accessoryCode}'에 해당하는 매핑을 찾을 수 없어 수량을 직접 업데이트하지 못했습니다.`);
      // 또는 여기서 오류를 발생시킬 수도 있음: throw new Error(...)
      lock.releaseLock();
      return { success: true, message: '매핑 정보가 아직 없어 수량을 업데이트하지 않았습니다. 매핑 저장 시 반영됩니다.' }; // 클라이언트에 혼란을 주지 않도록 성공으로 간주
    }

    // 수량 업데이트
    sheet.getRange(targetRowIndex, quantityCol + 1).setValue(numericQuantity);

    lock.releaseLock();
    Logger.log(`수량 업데이트 성공: ${sabangCode} - ${accessoryCode} = ${numericQuantity}`);
    return { success: true, message: '수량이 업데이트되었습니다.' };

  } catch (e) {
    Logger.log(`updateProductAccessoryQuantity 오류: ${e.stack}`);
    if (lock) { // lock 객체가 할당되었는지 확인 후 해제 시도
      try { lock.releaseLock(); } catch (err) { Logger.log(`락 해제 실패: ${err}`); }
    }
    return { success: false, message: `수량 업데이트 중 오류 발생: ${e.message}` };
  }
}