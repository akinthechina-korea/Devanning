import { chromium, type Browser, type Page } from 'playwright';
import type { BatchPrintJob, ManifestData, FormTemplate } from '@shared/schema';
import { promises as fs } from 'fs';
import path from 'path';

// Job 저장소 (메모리)
const jobs = new Map<string, BatchPrintJob>();

// Job 정리 설정 (30분 후 자동 삭제)
const JOB_EXPIRY_MS = 30 * 60 * 1000;

// HTML 이스케이프 (XSS 방지)
function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 싱글톤 브라우저 인스턴스
let browser: Browser | null = null;

// 브라우저 초기화
async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      // sandbox 활성화 (보안 강화)
      args: ['--disable-setuid-sandbox'],
    });
  }
  return browser;
}

// 브라우저 종료
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// Job 생성
export function createJob(
  manifestData: Array<{ data: ManifestData; template: FormTemplate }>
): BatchPrintJob {
  const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // 총 페이지 수 계산
  let totalPages = 2; // 시작 + 끝 페이지
  
  // BL별 그룹핑
  const blGroups = new Map<string, Array<{ data: ManifestData; template: FormTemplate }>>();
  manifestData.forEach(item => {
    const blNo = item.data.blNo || 'UNKNOWN';
    if (!blGroups.has(blNo)) {
      blGroups.set(blNo, []);
    }
    blGroups.get(blNo)!.push(item);
  });
  
  // 총 페이지 계산: 시작(1) + [구분(1) + 화물표(PLT×2)]×BL + 끝(1)
  totalPages += blGroups.size; // 구분 페이지
  manifestData.forEach(item => {
    const pltQty = parseInt(item.data.plt || '0', 10);
    totalPages += pltQty * 2;
  });
  
  const job: BatchPrintJob = {
    id,
    status: 'pending',
    manifestData,
    totalPages,
    processedPages: 0,
    createdAt: new Date(),
  };
  
  jobs.set(id, job);
  
  // 자동 정리 스케줄 (30분 후)
  setTimeout(() => cleanupJob(id), JOB_EXPIRY_MS);
  
  return job;
}

// Job 정리
async function cleanupJob(id: string) {
  const job = jobs.get(id);
  if (!job) return;
  
  // PDF 파일 삭제
  if (job.pdfPath) {
    try {
      await fs.unlink(job.pdfPath);
    } catch (error) {
      console.error(`Failed to delete PDF for job ${id}:`, error);
    }
  }
  
  // Job 삭제
  jobs.delete(id);
  console.log(`Cleaned up job ${id}`);
}

// Job 조회
export function getJob(id: string): BatchPrintJob | undefined {
  return jobs.get(id);
}

// Job 업데이트
export function updateJob(id: string, updates: Partial<BatchPrintJob>) {
  const job = jobs.get(id);
  if (job) {
    Object.assign(job, updates);
  }
}

// HTML 템플릿 생성 (batch-print 컴포넌트와 동일한 구조)
function generateHTML(manifestData: Array<{ data: ManifestData; template: FormTemplate }>): string {
  // BL별 그룹핑
  const blGroups = new Map<string, Array<{
    itemNo: string;
    pltQty: number;
    data: ManifestData;
    template: FormTemplate;
  }>>();
  
  manifestData.forEach(({ data, template }) => {
    const blNo = data.blNo || 'UNKNOWN';
    const itemNo = data.itemNo || 'UNKNOWN';
    const pltQty = parseInt(data.plt || '0', 10);
    
    if (!blGroups.has(blNo)) {
      blGroups.set(blNo, []);
    }
    blGroups.get(blNo)!.push({ itemNo, pltQty, data, template });
  });
  
  const blGroupsArray = Array.from(blGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const totalBls = blGroupsArray.length;
  const totalManifests = manifestData.length;
  const totalPages = 2 + blGroupsArray.length + manifestData.reduce((sum, item) => {
    const pltQty = parseInt(item.data.plt || '0', 10);
    return sum + pltQty * 2;
  }, 0);
  
  // 페이지 HTML 생성
  let pagesHTML = '';
  
  // 시작 페이지
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  pagesHTML += `
    <div class="batch-print-page">
      <div style="padding: 48px; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; text-align: center;">
        <div style="border-top: 4px solid #1e293b; border-bottom: 4px solid #1e293b; padding: 16px;">
          <h1 style="font-size: 36px; font-weight: bold; margin: 0;">화물 일괄 인쇄 시작</h1>
        </div>
        <div style="margin-top: 32px; font-size: 18px;">
          <p style="margin: 8px 0;">인쇄 날짜: ${escapeHtml(dateStr)} ${escapeHtml(timeStr)}</p>
        </div>
        <div style="margin-top: 32px; font-size: 20px; font-weight: 600;">
          <p style="margin: 8px 0;">총 BL 개수: ${totalBls}개</p>
          <p style="margin: 8px 0;">총 화물표 개수: ${totalManifests}개</p>
          <p style="margin: 8px 0;">총 인쇄 페이지: ${totalPages.toLocaleString()}장</p>
        </div>
      </div>
    </div>
  `;
  
  // BL 그룹별 페이지
  blGroupsArray.forEach(([blNo, items]) => {
    const totalManifestsInBl = items.length;
    const totalPagesInBl = items.reduce((sum, item) => sum + item.pltQty * 2, 0);
    
    // 구분 페이지
    pagesHTML += `
      <div class="batch-print-page">
        <div style="padding: 48px; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; text-align: center;">
          <h2 style="font-size: 32px; font-weight: bold; margin-bottom: 32px;">BL ${escapeHtml(blNo)}</h2>
          <div style="font-size: 20px;">
            <p style="margin: 12px 0;">Item 목록:</p>
            ${items.map((item, idx) => `<p style="margin: 8px 0;">${idx + 1}. #${escapeHtml(item.itemNo)} (PLT ${item.pltQty} × 2 = ${item.pltQty * 2}장)</p>`).join('')}
          </div>
          <div style="margin-top: 32px; font-size: 18px; font-weight: 600;">
            <p style="margin: 8px 0;">총 화물표: ${totalManifestsInBl}개</p>
            <p style="margin: 8px 0;">총 인쇄 페이지: ${totalPagesInBl}장</p>
          </div>
        </div>
      </div>
    `;
    
    // 화물표 페이지들
    items.forEach(item => {
      const copies = item.pltQty * 2;
      for (let i = 0; i < copies; i++) {
        pagesHTML += generateManifestPage(item.data, item.template);
      }
    });
  });
  
  // 끝 페이지
  pagesHTML += `
    <div class="batch-print-page">
      <div style="padding: 48px; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: center; text-align: center;">
        <div style="border-top: 4px solid #1e293b; border-bottom: 4px solid #1e293b; padding: 16px;">
          <h1 style="font-size: 36px; font-weight: bold; margin: 0;">화물 일괄 인쇄 완료</h1>
        </div>
        <div style="margin-top: 32px; font-size: 20px; font-weight: 600;">
          <p style="margin: 8px 0;">총 BL 개수: ${totalBls}개</p>
          <p style="margin: 8px 0;">총 화물표 개수: ${totalManifests}개</p>
          <p style="margin: 8px 0;">총 인쇄 페이지: ${totalPages.toLocaleString()}장</p>
        </div>
      </div>
    </div>
  `;
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Noto Sans KR', sans-serif;
          width: 210mm;
          height: 297mm;
        }
        
        .batch-print-page {
          width: 210mm;
          height: 297mm;
          page-break-after: always;
          page-break-inside: avoid;
          background: white;
          position: relative;
        }
        
        .batch-print-page:last-child {
          page-break-after: auto;
        }
        
        @page {
          size: A4 portrait;
          margin: 0;
        }
      </style>
    </head>
    <body>
      ${pagesHTML}
    </body>
    </html>
  `;
}

// 화물표 페이지 HTML 생성
function generateManifestPage(data: ManifestData, template: FormTemplate): string {
  const structure = template.structure as any;
  const fields = structure.fields || [];
  
  let fieldsHTML = '';
  fields.forEach((field: any) => {
    const value = (data as any)[field.field] || '';
    fieldsHTML += `
      <div style="
        position: absolute;
        left: ${parseInt(field.x)}px;
        top: ${parseInt(field.y)}px;
        width: ${parseInt(field.width)}px;
        height: ${parseInt(field.height)}px;
        font-size: ${parseInt(field.fontSize)}px;
        color: ${escapeHtml(field.color)};
        font-weight: ${escapeHtml(field.fontWeight)};
        text-align: ${escapeHtml(field.textAlign)};
        display: flex;
        align-items: center;
        ${field.textAlign === 'center' ? 'justify-content: center;' : ''}
        ${field.textAlign === 'right' ? 'justify-content: flex-end;' : ''}
        overflow: hidden;
      ">
        ${escapeHtml(String(value))}
      </div>
    `;
  });
  
  return `
    <div class="batch-print-page">
      <div style="position: relative; width: 100%; height: 100%; padding: 64px;">
        ${structure.templateImage ? `<img src="${structure.templateImage}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain;" />` : ''}
        ${fieldsHTML}
      </div>
    </div>
  `;
}

// PDF 생성
export async function generatePDF(jobId: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) {
    throw new Error('Job not found');
  }
  
  try {
    updateJob(jobId, { status: 'processing' });
    
    const browser = await getBrowser();
    const page = await browser.newPage();
    
    // HTML 생성
    const html = generateHTML(job.manifestData);
    
    // HTML 설정
    await page.setContent(html, { waitUntil: 'networkidle' });
    
    // PDF 생성
    const pdfDir = path.join(process.cwd(), 'pdfs');
    await fs.mkdir(pdfDir, { recursive: true });
    
    const filename = `batch-print-${jobId}.pdf`;
    const pdfPath = path.join(pdfDir, filename);
    
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    
    await page.close();
    
    updateJob(jobId, {
      status: 'completed',
      pdfPath,
      processedPages: job.totalPages,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error('PDF generation error:', error);
    updateJob(jobId, {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
