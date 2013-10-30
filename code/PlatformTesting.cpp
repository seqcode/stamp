//////////////////////////////////////////////////////////////////////////////////
//
// STAMP version 1 
//
// Written By: Shaun Mahony
//
// PlatformTesting.cpp
//
// Started: 18th Nov 2005
//
// Copyright 2007 Shaun Mahony
//
// This file is part of STAMP.
//
// STAMP is free software; you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation; either version 2 of the License, or
// (at your option) any later version.
//
// STAMP is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with STAMP; if not, write to the Free Software
// Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
//
////////////////////////////////////////////////////////////////////////////////////


#include "PlatformTesting.h"
#include <gsl/gsl_randist.h>
#include <gsl/gsl_histogram.h>

struct tmp_rec{
	bool marker;
	double score;
};

int compare( const void *arg1, const void *arg2 ){
	tmp_rec* a1 = (tmp_rec*)arg1;
	tmp_rec* a2 = (tmp_rec*)arg2;
	if(a1->score == a2->score)
		return(0);
	else if(a1->score<a2->score)
		return(1);
	else
		return(-1);
}

int compare2( const void *arg1, const void *arg2 ){
	tmp_rec* a1 = (tmp_rec*)arg1;
	tmp_rec* a2 = (tmp_rec*)arg2;
	if(a1->score == a2->score)
		return(0);
	else if(a1->score<a2->score)
		return(-1);
	else
		return(1);
}

//Generate random columns from a Dirichlet distribution
void PlatformTesting::RandColumns(PlatformSupport* PS, double infoContent)
{
	long i,j;
	const long NUM_RC = 1000000;
	const double D_VAR = 20.0;
	double alphaA[4];
	double alphaB[4];
	double theta[4];
	double t_currScore=0;
	double f_currScore=0;
	double TP=0, FP=0;
	char set;
	Motif* t_curr = new Motif(1);
	Motif* f_curr = new Motif(1);
	gsl_rng * r = gsl_rng_alloc (gsl_rng_taus);
	tmp_rec* curr_record;
	
	tmp_rec* pcc_record = new tmp_rec [NUM_RC*2];
	tmp_rec* allr_record = new tmp_rec [NUM_RC*2];
	tmp_rec* ssd_record = new tmp_rec [NUM_RC*2];
	tmp_rec* cs_record = new tmp_rec [NUM_RC*2];
	tmp_rec* kl_record = new tmp_rec [NUM_RC*2];
	for(i=0; i<NUM_RC*2; i++){
		pcc_record[i].score = -10000; pcc_record[i].marker=false;
		allr_record[i].score = -10000; allr_record[i].marker=false;
		ssd_record[i].score = -10000; ssd_record[i].marker=false;
		cs_record[i].score = -10000; cs_record[i].marker=false;
		kl_record[i].score = -10000; kl_record[i].marker=false;
	}

	//Motifs
	//set this from the info content later
	Motif* t_centre = new Motif(1);
	t_centre->f[0][0] = infoContent; t_centre->f[0][1] = (1-t_centre->f[0][0])/3; t_centre->f[0][2] = (1-t_centre->f[0][0])/3; t_centre->f[0][3] = (1-t_centre->f[0][0])/3;
	PS->f_to_n(t_centre); PS->n_to_pwm(t_centre);
	printf("True_Motif_IC: %.4lf\t", PS->InfoContent(t_centre));
	Motif* f_centre = new Motif(1);
	f_centre->f[0][0] = 0.25; f_centre->f[0][1] = 0.25; f_centre->f[0][2] = 0.25; f_centre->f[0][3] = 0.25;
	PS->f_to_n(f_centre); PS->n_to_pwm(f_centre);
	printf("False_MotifIC: %.4lf\t", PS->InfoContent(f_centre));

	//Column comps
	ColumnComp* cc_pcc = new PearsonCorrelation();
	ColumnComp* cc_allr = new ALLR();
	ColumnComp* cc_ssd = new SumSqDiff();
	ColumnComp* cc_cs = new ChiSq();
	ColumnComp* cc_kl = new KullbackLieber();


	//Make basic columns here
	for(j=0; j<4; j++){ alphaA[j] = t_centre->f[0][j]*D_VAR;}
	for(j=0; j<4; j++){ alphaB[j] = f_centre->f[0][j]*D_VAR;}
	
	for(i=0; i<NUM_RC; i++){
		
		gsl_ran_dirichlet(r, 4, alphaA, t_curr->f[0]);			
		PS->f_to_n(t_curr); PS->n_to_pwm(t_curr);//printf("%lf\t%lf\t%lf\t%lf", t_curr->pwm[0][0], t_curr->pwm[0][1], t_curr->pwm[0][2], t_curr->pwm[0][3]);
		gsl_ran_dirichlet(r, 4, alphaB, f_curr->f[0]);				
		PS->f_to_n(f_curr); PS->n_to_pwm(f_curr);

		t_currScore = cc_pcc->Compare(t_centre, 0, t_curr, 0);
		pcc_record[i*2].marker = true;
		pcc_record[i*2].score = t_currScore;
		t_currScore = cc_allr->Compare(t_centre, 0, t_curr, 0);//printf("\t%lf\n",t_currScore);
		allr_record[i*2].marker = true;
		allr_record[i*2].score = t_currScore;
		t_currScore = cc_ssd->Compare(t_centre, 0, t_curr, 0);
		ssd_record[i*2].marker = true;
		ssd_record[i*2].score = t_currScore;
		t_currScore = cc_cs->Compare(t_centre, 0, t_curr, 0);
		cs_record[i*2].marker = true;
		cs_record[i*2].score = t_currScore;
		t_currScore = cc_kl->Compare(t_centre, 0, t_curr, 0);
		kl_record[i*2].marker = true;
		kl_record[i*2].score = t_currScore;
				
		f_currScore = cc_pcc->Compare(t_centre, 0, f_curr, 0);
		pcc_record[(i*2)+1].marker = false;
		pcc_record[(i*2)+1].score = f_currScore;
		f_currScore = cc_allr->Compare(t_centre, 0, f_curr, 0);
		allr_record[(i*2)+1].marker = false;
		allr_record[(i*2)+1].score = f_currScore;
		f_currScore = cc_ssd->Compare(t_centre, 0, f_curr, 0);
		ssd_record[(i*2)+1].marker = false;
		ssd_record[(i*2)+1].score = f_currScore;
		f_currScore = cc_cs->Compare(t_centre, 0, f_curr, 0);
		cs_record[(i*2)+1].marker = false;
		cs_record[(i*2)+1].score = f_currScore;
		f_currScore = cc_kl->Compare(t_centre, 0, f_curr, 0);
		kl_record[(i*2)+1].marker = false;
		kl_record[(i*2)+1].score = f_currScore;
	}
	
	//Sort the results
	qsort((void*)pcc_record, (size_t)(NUM_RC*2), sizeof(tmp_rec), compare);
	qsort((void*)allr_record, (size_t)(NUM_RC*2), sizeof(tmp_rec), compare);
	qsort((void*)ssd_record, (size_t)(NUM_RC*2), sizeof(tmp_rec), compare);
	qsort((void*)cs_record, (size_t)(NUM_RC*2), sizeof(tmp_rec), compare); //used to be compare 2
	qsort((void*)kl_record, (size_t)(NUM_RC*2), sizeof(tmp_rec), compare); //used to be compare2

	//do for each metric
	double* FP_perc_record = new double[NUM_RC*2];
	double* TP_record = new double[NUM_RC*2];
	double FP_perc=0, win_FP_perc=0, win_TP=0;
	bool found_0_1=false, found_0_5=false, found_1=false, found_5=false, found_10=false;
	int win_start=0, win_stop, win_stop_init = win_stop;
	for(int x=0; x<5; x++){
		
		if(x==0){printf("PCC:\t");
		}else if(x==1){printf("ALLR:\t");
		}else if(x==2){printf("SSD:\t");
		}else if(x==3){printf("CS:\t");
		}else if(x==4){printf("KL:\t");
		}

		//Scan through the results, keeping tabs on TP & FP and checking for milestones
		FP_perc=0; win_FP_perc=0; win_TP=0;
		found_0_1=false; found_0_5=false; found_1=false; found_5=false; found_10=false;
		win_start=0; win_stop =10000; win_stop_init = win_stop;
		TP=0; FP=0;
		
		for(i=0; i<NUM_RC*2; i++){
			if(x==0){
				if(pcc_record[i].marker){TP++; }
				else{FP++;}	
			}else if(x==1){
				if(allr_record[i].marker){TP++; }
				else{FP++;}
			}else if(x==2){
				if(ssd_record[i].marker){TP++; }
				else{FP++;}
			}else if(x==3){
				if(cs_record[i].marker){TP++; }
				else{FP++;}
			}else if(x==4){
				if(kl_record[i].marker){TP++; }
				else{FP++;}
			}

			FP_perc = (FP/(TP+FP))*100; //printf("%lf\t%lf\n", FP_perc, TP/NUM_RC*100);
			FP_perc_record[i]=FP_perc;
			TP_record[i]=TP;
			if(i<win_stop_init){
				win_FP_perc+=FP_perc;
				win_TP+=TP;
			}else{
				win_start++; win_stop++;
				if(win_stop>=(NUM_RC*2)-1)
					win_stop=(NUM_RC*2)-1;
				else{
					win_FP_perc+=FP_perc_record[i];
					win_TP+=TP_record[i];
				}			
				win_FP_perc-=FP_perc_record[win_start-1];
				win_TP-=TP_record[win_start-1];

				if(!found_0_1 && (win_FP_perc/(win_stop-win_start) >0.1)){
					found_0_1=true; //printf("0.1: %.5lf\t", (win_TP/(win_stop-win_start))/NUM_RC*100);
				}if(!found_0_5 && (win_FP_perc/(win_stop-win_start) >0.5)){
					found_0_5=true; printf("0.5: %.5lf\t", (win_TP/(win_stop-win_start))/NUM_RC*100);
				}if(!found_1 && (win_FP_perc/(win_stop-win_start) >1.0)){
					found_1=true; printf("1.0: %.5lf\t", (win_TP/(win_stop-win_start))/NUM_RC*100);
				}if(!found_5 && (win_FP_perc/(win_stop-win_start) >5.0)){
					found_5=true; printf("5.0: %.5lf\t", (win_TP/(win_stop-win_start))/NUM_RC*100);
				}if(!found_10 && (win_FP_perc/(win_stop-win_start) >10.0)){
					found_10=true; printf("10.0: %.5lf\t", (win_TP/(win_stop-win_start))/NUM_RC*100);
				}
			}
		}
	}
	printf("\n");

	gsl_rng_free(r);
	delete [] ssd_record;
	delete [] allr_record;
	delete [] pcc_record;
	delete [] cs_record;
	delete [] kl_record;
	delete [] FP_perc_record;
	delete [] TP_record;
	delete t_curr; delete f_curr;
	delete t_centre; delete f_centre;
	delete cc_pcc;
	delete cc_allr;
	delete cc_ssd;
	delete cc_kl;
	delete cc_cs;
}

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//For every motif in the input, compare its columns to the rest in the set and put scores first in an array, and then in a histogram
void PlatformTesting::ColumnScoreDist(Motif** motifSet, int numMotifs, double interval)
{
	int i, j, x, y, z;
	double currScore;
	double h_max=3.0; double h_min=-3.0; int h_min_int = abs((int)h_min);
	double* histogram;
	double histoTmp = (fabs(h_min)+fabs(h_max))/interval;
	int histoSize = (int)histoTmp+1;
	histogram = new double[histoSize];
	for(z=0; z<histoSize; z++){
		histogram[z]=0;
	}

	for(i=0; i<numMotifs; i++){
		for(j=0; j<motifSet[i]->len; j++){
			//For each column in motif i...
			for(x=0; x<numMotifs; x++){
				for(y=0; y<motifSet[x]->len; y++){
					//compare to column y in motif x
					if(!(i==x && j==y)){
						currScore =  Metric->Compare(motifSet[i], j, motifSet[x], y);
						//Add to histogram
						if(currScore<=h_min)
							histogram[0]++; 
						else if(currScore>=h_max)
							histogram[histoSize-1]++;
						else{
							z=(int)((currScore+h_min_int)/interval);
							histogram[z]++;
						}
					}
				}
			}
		}
	}
	for(z=0; z<histoSize; z++){
		printf("%.4lf\t%.0lf\n", h_min+((double)z*interval), histogram[z]);
	}
	delete [] histogram;
}

//////////////////////////////////////////////////////////////////////////////
//For every motif in the input put site depths in a histogram
void PlatformTesting::ColumnDepthDist(Motif** motifSet, int numMotifs)
{
	int i, j, k, z, cols=0;
	double ttl=0; 
	double sum_of_all=0, sum_of_one=0;
	double h_max=50.0; double h_min=0.0; int h_min_int = abs((int)h_min);
	double* histogram;
	int histoSize = (int)(fabs(h_min)+fabs(h_max))+1;
	histogram = new double[histoSize];
	for(z=0; z<histoSize; z++){
		histogram[z]=0;
	}

	for(i=0; i<numMotifs; i++){
		sum_of_one=0;
		for(j=0; j<motifSet[i]->len; j++){
			//Find size of each column in motif i...
			ttl=0;
			for(k=0; k<B; k++){
				ttl+=motifSet[i]->n[j][k];
			}sum_of_one+=ttl;
			//Add to histogram
			if(ttl<=h_max)
				histogram[(int)ttl]++; 
			else if(ttl>h_max)
				histogram[histoSize-1]++;	
			cols++;
		}
		sum_of_all += sum_of_one/(double)motifSet[i]->len;
	}
	for(z=0; z<histoSize; z++){
		printf("%.4lf\t%.0lf\n", h_min+((double)z), histogram[z]);
	}
	printf("Total Columns: %d\n", cols);
	printf("Average Column Depth: %.3lf\n", sum_of_all/numMotifs);
	delete [] histogram;
}

//Test pairwise accuracy
void PlatformTesting::PairwisePredictionAccuracy(PlatformSupport* PS)
{
	int i, j;
	double maxScore;
	int maxID=0;
	double correct=0, total=0, sc_total=0, correctPval=0;

	for(i=0; i<PS->GetMatCount(); i++){
		maxScore=-10000000;
		total++;
		for(j=0; j<PS->GetMatCount(); j++){
			if(i!=j){
				if(PS->pairwiseAlign[i][j].p_value>maxScore){
					maxScore = PS->pairwiseAlign[i][j].p_value;
					maxID=j;
				}
			}
		}
		if(strcmp(PS->inputMotifs[i]->famName, PS->inputMotifs[maxID]->famName)==0){
			correct++;
			correctPval+=maxScore;
		}
	}
	printf("Pairwise_Class_Accuracy:\t%lf (%.0lf / %.0lf)\t", correct/total, correct, total);
	printf("Avg_Correct_Score:\t%lf\n", correctPval/correct);
}

