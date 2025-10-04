import { screenResume } from './geminiService';
import type { ScreeningResult } from '../types';

export interface BulkResumeResult {
  candidateIndex: number;
  candidateName: string;
  screeningResult: ScreeningResult;
  processingTime: number;
}

export interface BulkProcessingSummary {
  totalResumes: number;
  processedResumes: number;
  successfulScreenings: number;
  failedScreenings: number;
  topCandidates: BulkResumeResult[];
  averageScore: number;
  processingTime: number;
  recommendations: {
    strongHire: BulkResumeResult[];
    hire: BulkResumeResult[];
    consider: BulkResumeResult[];
    noHire: BulkResumeResult[];
  };
}

export class BulkResumeProcessor {
  private jobDescription: string;
  private onProgress?: (processed: number, total: number, currentCandidate?: string) => void;

  constructor(jobDescription: string, onProgress?: (processed: number, total: number, currentCandidate?: string) => void) {
    this.jobDescription = jobDescription;
    this.onProgress = onProgress;
  }

  /**
   * Parse resumes from a text file where each resume is separated by a delimiter
   */
  parseResumesFromText(content: string): string[] {
    // Split by common delimiters
    const delimiters = [
      '---RESUME---',
      '===RESUME===',
      '***RESUME***',
      '\n\n---\n\n',
      '\n\n===\n\n',
      /Resume \d+:/gi,
      /Candidate \d+:/gi
    ];

    let resumes: string[] = [];

    // Try each delimiter
    for (const delimiter of delimiters) {
      if (typeof delimiter === 'string') {
        const split = content.split(delimiter);
        if (split.length > 1) {
          resumes = split.filter(resume => resume.trim().length > 100); // Filter out empty/short sections
          break;
        }
      } else {
        const split = content.split(delimiter);
        if (split.length > 1) {
          resumes = split.filter(resume => resume.trim().length > 100);
          break;
        }
      }
    }

    // If no delimiters found, try to split by double line breaks and look for resume patterns
    if (resumes.length === 0) {
      const sections = content.split(/\n\s*\n\s*\n/);
      resumes = sections.filter(section => {
        const lowerSection = section.toLowerCase();
        return section.trim().length > 200 && (
          lowerSection.includes('experience') ||
          lowerSection.includes('education') ||
          lowerSection.includes('skills') ||
          lowerSection.includes('work') ||
          lowerSection.includes('resume')
        );
      });
    }

    // Clean up resumes
    return resumes.map(resume => resume.trim()).filter(resume => resume.length > 100);
  }

  /**
   * Process a single resume with error handling and retry logic
   */
  async processSingleResume(resumeText: string, index: number): Promise<BulkResumeResult | null> {
    const startTime = Date.now();
    
    try {
      const screeningResult = await screenResume(this.jobDescription, resumeText);
      const processingTime = Date.now() - startTime;

      if (this.onProgress) {
        this.onProgress(index + 1, -1, screeningResult.candidate_name);
      }

      return {
        candidateIndex: index,
        candidateName: screeningResult.candidate_name,
        screeningResult,
        processingTime
      };
    } catch (error) {
      console.error(`Failed to process resume ${index + 1}:`, error);
      
      if (this.onProgress) {
        this.onProgress(index + 1, -1, `Failed: Resume ${index + 1}`);
      }
      
      return null;
    }
  }

  /**
   * Process all resumes with controlled concurrency to avoid API rate limits
   */
  async processAllResumes(resumes: string[], concurrency: number = 3): Promise<BulkProcessingSummary> {
    const startTime = Date.now();
    const results: BulkResumeResult[] = [];
    const total = resumes.length;
    let processed = 0;
    let successful = 0;
    let failed = 0;

    // Process in batches to control API rate limits
    for (let i = 0; i < resumes.length; i += concurrency) {
      const batch = resumes.slice(i, i + concurrency);
      const batchPromises = batch.map((resume, batchIndex) => 
        this.processSingleResume(resume, i + batchIndex)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      for (const result of batchResults) {
        processed++;
        if (result.status === 'fulfilled' && result.value !== null) {
          results.push(result.value);
          successful++;
        } else {
          failed++;
        }

        if (this.onProgress) {
          this.onProgress(processed, total);
        }
      }

      // Add delay between batches to respect API rate limits
      if (i + concurrency < resumes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Sort results by match score (descending)
    results.sort((a, b) => b.screeningResult.match_score - a.screeningResult.match_score);

    // Categorize results
    const recommendations = {
      strongHire: results.filter(r => r.screeningResult.recommendation === 'STRONG_HIRE'),
      hire: results.filter(r => r.screeningResult.recommendation === 'HIRE'),
      consider: results.filter(r => r.screeningResult.recommendation === 'CONSIDER'),
      noHire: results.filter(r => r.screeningResult.recommendation === 'NO_HIRE')
    };

    // Get top candidates (top 10 or 10% of total, whichever is smaller)
    const topCount = Math.min(10, Math.ceil(results.length * 0.1));
    const topCandidates = results.slice(0, topCount);

    // Calculate average score
    const averageScore = results.length > 0 
      ? results.reduce((sum, r) => sum + r.screeningResult.match_score, 0) / results.length 
      : 0;

    return {
      totalResumes: total,
      processedResumes: processed,
      successfulScreenings: successful,
      failedScreenings: failed,
      topCandidates,
      averageScore,
      processingTime: Date.now() - startTime,
      recommendations
    };
  }

  /**
   * Get the best candidate from processed results
   */
  getBestCandidate(summary: BulkProcessingSummary): BulkResumeResult | null {
    if (summary.topCandidates.length === 0) return null;
    
    // First try to get the best STRONG_HIRE
    const strongHires = summary.recommendations.strongHire;
    if (strongHires.length > 0) {
      return strongHires[0]; // Already sorted by score
    }
    
    // Then try HIRE
    const hires = summary.recommendations.hire;
    if (hires.length > 0) {
      return hires[0];
    }
    
    // Finally, return the highest scoring candidate overall
    return summary.topCandidates[0];
  }

  /**
   * Generate a summary report
   */
  generateReport(summary: BulkProcessingSummary): string {
    const bestCandidate = this.getBestCandidate(summary);
    const processingTimeMin = Math.round(summary.processingTime / 60000);
    
    return `
# Bulk Resume Screening Report

## Summary
- **Total Resumes Processed**: ${summary.processedResumes}/${summary.totalResumes}
- **Success Rate**: ${Math.round((summary.successfulScreenings / summary.totalResumes) * 100)}%
- **Average Match Score**: ${Math.round(summary.averageScore)}%
- **Processing Time**: ${processingTimeMin} minutes

## Best Candidate
${bestCandidate ? `
**${bestCandidate.candidateName}**
- Match Score: ${bestCandidate.screeningResult.match_score}%
- Recommendation: ${bestCandidate.screeningResult.recommendation}
- Summary: ${bestCandidate.screeningResult.summary}
` : 'No suitable candidates found'}

## Recommendations Breakdown
- **Strong Hire**: ${summary.recommendations.strongHire.length} candidates
- **Hire**: ${summary.recommendations.hire.length} candidates  
- **Consider**: ${summary.recommendations.consider.length} candidates
- **No Hire**: ${summary.recommendations.noHire.length} candidates

## Top 5 Candidates
${summary.topCandidates.slice(0, 5).map((candidate, index) => `
${index + 1}. **${candidate.candidateName}** (${candidate.screeningResult.match_score}% - ${candidate.screeningResult.recommendation})
   ${candidate.screeningResult.summary}
`).join('\n')}
    `.trim();
  }
}

export default BulkResumeProcessor;