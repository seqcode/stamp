#!/usr/bin/perl -w

################################################
## formatMotifs.pl
##
## Copyright 2007 Shaun Mahony
##
## This file is part of STAMP.
##
## STAMP is free software; you can redistribute it and/or modify
## it under the terms of the GNU General Public License as published by
## the Free Software Foundation; either version 2 of the License, or
## (at your option) any later version.
##
## STAMP is distributed in the hope that it will be useful,
## but WITHOUT ANY WARRANTY; without even the implied warranty of
## MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
## GNU General Public License for more details.
##
## You should have received a copy of the GNU General Public License
## along with STAMP; if not, write to the Free Software
## Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
##
################################################

my $maxNumMotifsOut=1000000;
my $append=1;

my $maxFilename = 20;
my $CONS1 = 0.6;
my $CONS2 = 0.8;
my $coreLen = 4;
if($#ARGV<=0){
	print "formatMotifs.pl\n\n\tUsage: perl formatMotifs.pl inputFile outputFile <min flanking info content> <output motif prefix> <output motif postfix>\n";
	print "\n\tNote that converted motifs will be *appended* to the output file instead of overwriting it.\n\tVarious input formats are detected and converted to TRANSFAC-like format for usage with STAMP.\n\n\tThe list of supported input formats can be found at:\n\t    http://www.benoslab.pitt.edu/stamp/help.html#input\n";
}else{
my $inFilename = $ARGV[0];
my $outFilename = $ARGV[1];
my $trimming=0;
my $namePrefix = "";
my $namePostfix = "";
if($#ARGV>1){
	$trimming = 1;
	$minIC = $ARGV[2];
}if($#ARGV>2){
	$namePrefix = $ARGV[3];
}if($#ARGV>3){
	$namePostfix = $ARGV[4];
}

unless (open(CURR, $inFilename)) {
	die "Cannot open file: $!"; }
@linesCurr=<CURR>;

my @name;
my @currA;
my @currC;
my @currG;
my @currT;
my $good=0;
my $numMotifs=0;
my $InfName;
my %nameCheck =();
my $motif_finder=0;
my $alignace=0;
my $meme=0;
my $bioprospector=0;
my $weeder=0; $weedStr = "MY ADVICE";
my $mdscan=0;
my $motifsampler=0;
my $ymf=0;
my $annspec=0;
my $consensus=0; $consenStr = "THE LIST OF MATRICES FROM FINAL CYCLE";
my $consens_tops_end=0;
my $improbizer=0; $improb_color_coding=0;
my $chipmunk=0; $chipmunkStr="OUTC|ru_genetika.ChIPMunk";
my $cobind=0;
my @TransfacTags = qw(AC XX ID DE P0 PO NA DT CO BF VV CC RX RN RA RT RL BA);
my @MotifTags = ("DE", "NA", "P0", "PO", ">", "Blk1","Blk2", "letter-probability", "<motif>");
my @NonTransMotifTags = (">", "Blk1","Blk2", "position-specific probability matrix");
my $WeightOrFam="";

#Is the current file a motif-finder output file?
for($i=0; $i<=$#linesCurr && $i<5; $i++) {
	@curr = split(/\s+/, $linesCurr[$i]);
	if($#curr>=0){
		if($curr[0] eq "AlignACE"){
			$motif_finder=1;
			$alignace=1;
			$i=5;
		}elsif($curr[0] eq "MEME"){
			$motif_finder=1;
			$meme=1;
			$i=5;
		}elsif(($linesCurr[$i] =~ m/BioProspector/ || $linesCurr[$i] =~ m/CompareProspector/) && $linesCurr[$i+2] =~ m/\*\*\*\*\*\*\*\*\*\*\*\*/){
			$motif_finder=1;
			$bioprospector=1;
			$i=5;
		}elsif($i<=$#linesCurr+5 && $curr[0] eq "Pm" && $linesCurr[$i+3] =~ m/Mtf / && $linesCurr[$i+4] =~ m/Final Motif/){
			$motif_finder=1;
			$mdscan=1;
			$i=5;
		}elsif($linesCurr[$i] =~ m/INCLUSive Motif Model/){
			$motif_finder=1;
			$motifsampler=1;
			$i=5;
		}elsif(($curr[0] eq "The" && $curr[1] eq "best" && $curr[3] eq "candidates" && $curr[5] eq "category") || ($curr[0] eq "Motif" && $curr[1] eq "Count" && $curr[2] eq "Zscore")){
			$motif_finder=1;
			$ymf=1;
			$i=5;
		}elsif(($curr[0] eq "SQI")&&($curr[1] eq "SEQUENCE_INFORMATION:")){
			$motif_finder=1;
			$annspec=1;
			$i=5;
		}elsif($linesCurr[$i] =~ m/Improbizer Results/){
			$motif_finder=1;
			$improbizer=1;
			$i=5;
		}elsif($linesCurr[$i] =~ m/\# reading predefined alphabet from file / && $linesCurr[$i+1] =~ m/\# \*\*\*\*\* sequence information from sequence set/){
			$motif_finder=1;
			$cobind=1;
			$i=5;
		}elsif($linesCurr[$i] =~ m/$chipmunkStr/){
			$motif_finder=1;
			$chipmunk=1;
			$i=5;
		}
	}
}#more tests for motif-finder output
for($i=0; $i<=$#linesCurr; $i++) {
	@curr = split(/\s+/, $linesCurr[$i]);
	if($#curr>=0){
		if($i<$#linesCurr-3 && $linesCurr[$i] =~ m/$weedStr/ && $linesCurr[$i+3] =~ m/\*\*\* Interesting motifs \(highest-ranking\) seem to be/){
			$motif_finder=1;
			$weeder=1;
			$i=$#linesCurr+1;
		}elsif($i<$#linesCurr-2 && $linesCurr[$i] =~ m/MDscan Search Result/ && $linesCurr[$i+2] =~ m/\*\*\*\*\*\*\*\*\*\*\*\*/){
			$motif_finder=1;
			$mdscan=1;
			$i=$#linesCurr+1;
		}elsif($linesCurr[$i] =~ m/$consenStr/){
			$motif_finder=1;
			$consensus=1;
			$consens_tops_end=$i;
			$i=$#linesCurr+1;
		}elsif($improbizer==1 && $linesCurr[$i] =~ m/Color Coding for Profiles/){
			$improb_color_coding=$i;
		}
	}
}

#Detect individual motifs and reformat
for($i=0; $i<=$#linesCurr; $i++) {

	@currA = "";
	@currC = "";
	@currG = "";
	@currT = "";
	$good=0;
	@curr = split(" ", $linesCurr[$i]);
	if($#curr>=0 && length($curr[0])>0){
		@firstWord=split(//, $curr[0]);
	}else{
		$firstWord[0]="Z";
	}

	###################################################################
	### Translation area
	###
	### First deal with the motif-finder file formats
	if($#curr>=0){
	if($motif_finder==1){
		if($bioprospector==1 && $#curr>=0 && ($curr[0] eq "Blk1" || $curr[0] eq "Blk2")){#BioProspector results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$finished=0;
			$x=0;$i++;
			while($i<=$#linesCurr && $finished==0){
				@tmp = split(" ",  $linesCurr[$i]);
				if($finished==0 && $#tmp ==8){
					$currA[$x]=$tmp[1];
					$currC[$x]=$tmp[2];
					$currG[$x]=$tmp[3];
					$currT[$x]=$tmp[4];
					if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
						$finished=1; $x=0;
					}
					$x++;
					$i++;
				}else{
					$finished=1;
				}
			}
			if($x>0){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($mdscan==1 && $#curr>=0 && (($curr[0] eq "Final" && $curr[1] eq "Motif") || ($curr[0] eq "Motif" && $curr[2] eq "Wid"))){#MDscan results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$finished=0;
			$x=0;
			if($curr[0] eq "Motif"){$i+=3;
			}else{$i+=2;}

			while($i<=$#linesCurr && $finished==0){
				@tmp = split(" ",  $linesCurr[$i]);
				if($finished==0 && $#tmp ==8 && $tmp[0] !~ m/\>/){
					$currA[$x]=$tmp[1];
					$currC[$x]=$tmp[2];
					$currG[$x]=$tmp[3];
					$currT[$x]=$tmp[4];
					if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
						$finished=1; $x=0;
					}
					$x++;
					$i++;
				}else{
					$finished=1;
				}
			}
			if($x>0){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($meme==1 && $#curr>=0 && $curr[0] =~ m/letter-probability/){#MEME results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			@tmp = split(" ",  $linesCurr[$i+1]);
			if($#tmp ==3){
				$i++;$finished=0;$x=0;
				while($i<=$#linesCurr && $finished==0){
					@tmp = split(" ",  $linesCurr[$i]);
					if($finished==0 && ($#tmp ==3)){
						$currA[$x]=$tmp[0];
						$currC[$x]=$tmp[1];
						$currG[$x]=$tmp[2];
						$currT[$x]=$tmp[3];
						if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
							$finished=1; $x=0;
						}
						$x++;
						$i++;
					}else{
						$finished=1;
					}
				}
				if($x>0){
					print "$InfName\n";
					$good=1;
					$numMotifs++;
				}
			}
		}elsif($alignace==1 && $#curr>=0 && $curr[0] eq "Motif"){#AlignACE results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			@tmp = split(" ",  $linesCurr[$i+1]);
			if($#tmp ==3){
				$i++;$finished=0;
				$x=length($tmp[0]);
				for($c=0; $c<$x; $c++){$currA[$c]=0;$currC[$c]=0;$currG[$c]=0;$currT[$c]=0;}
				while($i<=$#linesCurr && $finished==0){
					@tmp = split(" ",  $linesCurr[$i]);
					if($finished==0 && ($#tmp ==3) && $tmp[0] !~ m/\*/){
						$seq = $tmp[0];
						$seq =~ tr/a-z/A-Z/;
						if(length($seq)!=$x){#length inconsistency
							$finished=1; $x=0;
						}else{
							@currSeqBP = split(//, $seq);
							for($c=0; $c<=$#currSeqBP; $c++){
								@currBase = consensus2column($currSeqBP[$c]);

								$currA[$c]+=$currBase[0];
								$currC[$c]+=$currBase[1];
								$currG[$c]+=$currBase[2];
								$currT[$c]+=$currBase[3];
								if($currA[$c]<0 || $currC[$c]<0 || $currG[$c]<0 || $currT[$c]<0){
									$finished=1; $x=0;
								}
							}
						}
						$i++;
					}else{
						$finished=1;
					}
				}
				if($x>0){
					print "$InfName\n";
					$good=1;
					$numMotifs++;
				}
			}
		}elsif($weeder==1 && $linesCurr[$i] =~ m/Frequency Matrix/ ){#Weeder results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$i+=3;$finished=0;$x=0;
			while($i<=$#linesCurr && $finished==0){
				@tmp = split(" ",  $linesCurr[$i]);
				if($finished==0 && ($#tmp ==8)){
					$currA[$x]=$tmp[1];
					$currC[$x]=$tmp[2];
					$currG[$x]=$tmp[3];
					$currT[$x]=$tmp[4];
					if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
						$finished=1; $x=0;
					}
					$x++;
					$i++;
				}else{
					$finished=1;
				}
			}
			if($x>0){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($motifsampler==1 && $linesCurr[$i] =~ m/Consensus/ ){#MotifSampler results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$i++;$finished=0;$x=0;
			while($i<=$#linesCurr && $finished==0){
				@tmp = split(" ",  $linesCurr[$i]);
				if($finished==0 && ($#tmp ==3)){
					$currA[$x]=$tmp[0];
					$currC[$x]=$tmp[1];
					$currG[$x]=$tmp[2];
					$currT[$x]=$tmp[3];
					if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
						$finished=1; $x=0;
					}
					$x++;$i++;
				}else{$finished=1;}
			}
			if($x>0){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($ymf==1 && ($#curr==2 || $#curr==4 ) && !($curr[0] eq "Motif")){#YMF results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$finished=0;$x=0;
			@tmp = split(" ",  $linesCurr[$i]);
			$x=length($tmp[0]);
			for($c=0; $c<$x; $c++){
				$currA[$c]=0; $currC[$c]=0; $currG[$c]=0; $currT[$c]=0;
			}
			$seq = $tmp[0];
			$seq =~ tr/a-z/A-Z/;
			@currSeqBP = split(//, $seq);
			for($c=0; $c<=$#currSeqBP; $c++){
				@currBase = consensus2column($currSeqBP[$c]);
				$currA[$c]+=$currBase[0];
				$currC[$c]+=$currBase[1];
				$currG[$c]+=$currBase[2];
				$currT[$c]+=$currBase[3];
				if($currA[$c]<0 || $currC[$c]<0 || $currG[$c]<0 || $currT[$c]<0){
					$finished=1; $x=0;
				}
			}
			if($x>0){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($annspec==1 && $curr[0] eq "ALR" && $curr[1] eq "/"){#ANN-Spec results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$i++;$finished=0;$x=0;
			$base_cols=0;
			for($x=0; $x<4; $x++){
				$i++;
				@tmp = split(" ",  $linesCurr[$i]);
				if($tmp[1] =~ m/A/){$base_cols++;
					for($z=2; $z<=$#tmp; $z++){
						$currA[$z-2]= $tmp[$z];if($currA[$z-2]<0){$x=4;}
					}
				}elsif($tmp[1] =~ m/C/){
					for($z=2; $z<=$#tmp; $z++){
						$currC[$z-2]= $tmp[$z];if($currC[$z-2]<0){$x=4;}
					}if($#currC==$#currA){$base_cols++;}
				}elsif($tmp[1]  =~ m/G/){
					for($z=2; $z<=$#tmp; $z++){
						$currG[$z-2]= $tmp[$z];if($currG[$z-2]<0){$x=4;}
					}if($#currG==$#currA){$base_cols++;}
				}elsif($tmp[1]  =~ m/T/){
					for($z=2; $z<=$#tmp; $z++){
						$currT[$z-2]= $tmp[$z];if($currT[$z-2]<0){$x=4;}
					}if($#currT==$#currA){$base_cols++;}
				}
			}
			if($base_cols==4){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($consensus==1 && $i>$consens_tops_end && $curr[0] eq "A" && $curr[1] =~ m/\|/){#Consensus results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$finished=0;$x=0;
			$base_cols=0;
			for($x=0; $x<4; $x++){
				@tmp = split(" ",  $linesCurr[$i]);
				if($tmp[0] eq "A"){$base_cols++;
					for($z=2; $z<=$#tmp; $z++){
						$currA[$z-2]= $tmp[$z];if($currA[$z-2]<0){$x=4;}
					}
				}elsif($tmp[0] eq "C"){
					for($z=2; $z<=$#tmp; $z++){
						$currC[$z-2]= $tmp[$z];if($currC[$z-2]<0){$x=4;}
					}if($#currC==$#currA){$base_cols++;}
				}elsif($tmp[0] eq "G"){
					for($z=2; $z<=$#tmp; $z++){
						$currG[$z-2]= $tmp[$z];if($currG[$z-2]<0){$x=4;}
					}if($#currG==$#currA){$base_cols++;}
				}elsif($tmp[0] eq "T"){
					for($z=2; $z<=$#tmp; $z++){
						$currT[$z-2]= $tmp[$z];if($currT[$z-2]<0){$x=4;}
					}if($#currT==$#currA){$base_cols++;}
				}$i++;
			}
			if($base_cols==4){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($improbizer==1 && $i<$improb_color_coding && $linesCurr[$i]=~ m/ \@ / && $linesCurr[$i]=~ m/ sd /){#Improbizer results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$finished=0;$x=0;
			$base_cols=0;
			$i++;
			for($x=0; $x<4; $x++){
				@tmp = split(" ",  $linesCurr[$i]);
				if($tmp[0] eq "a"){$base_cols++;
					for($z=1; $z<=$#tmp; $z++){
						$currA[$z-1]= $tmp[$z];if($currA[$z-1]<0){$x=4;}
					}
				}elsif($tmp[0] eq "c"){
					for($z=1; $z<=$#tmp; $z++){
						$currC[$z-1]= $tmp[$z];if($currC[$z-1]<0){$x=4;}
					}if($#currC==$#currA){$base_cols++;}
				}elsif($tmp[0] eq "g"){
					for($z=1; $z<=$#tmp; $z++){
						$currG[$z-1]= $tmp[$z];if($currG[$z-1]<0){$x=4;}
					}if($#currG==$#currA){$base_cols++;}
				}elsif($tmp[0] eq "t"){
					for($z=1; $z<=$#tmp; $z++){
						$currT[$z-1]= $tmp[$z];if($currT[$z-1]<0){$x=4;}
					}if($#currT==$#currA){$base_cols++;}
				}$i++;
			}
			if($base_cols==4){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($cobind==1 && $linesCurr[$i]=~ m/ ALIGNMENT_MATRIX/){#Co-bind results file
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$finished=0;$x=0;
			$base_cols=0;
			$i+=3;
			for($x=0; $x<4; $x++){
				@tmp = split(" ",  $linesCurr[$i]);
				if($tmp[0] eq "A|"){$base_cols++;
					for($z=1; $z<=$#tmp; $z++){
						$currA[$z-1]= $tmp[$z];if($currA[$z-1]<0){$x=4;}
					}
				}elsif($tmp[0] eq "C|"){
					for($z=1; $z<=$#tmp; $z++){
						$currC[$z-1]= $tmp[$z];if($currC[$z-1]<0){$x=4;}
					}if($#currC==$#currA){$base_cols++;}
				}elsif($tmp[0] eq "G|"){
					for($z=1; $z<=$#tmp; $z++){
						$currG[$z-1]= $tmp[$z];if($currG[$z-1]<0){$x=4;}
					}if($#currG==$#currA){$base_cols++;}
				}elsif($tmp[0] eq "T|"){
					for($z=1; $z<=$#tmp; $z++){
						$currT[$z-1]= $tmp[$z];if($currT[$z-1]<0){$x=4;}
					}if($#currT==$#currA){$base_cols++;}
				}$i++;
			}
			if($base_cols==4){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($chipmunk==1 && $linesCurr[$i]=~ m/^A\|/){#ChIPmunk results
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			$finished=0;$x=0;
			$base_cols=0;
			for($x=0; $x<4; $x++){
				@tmp = split(" ",  $linesCurr[$i]);
				if($tmp[0] =~ m/^A\|/){
				    $base_cols++;
				    $tmp[0] =~ s/A\|//g;
				    for($z=0; $z<=$#tmp; $z++){
					$currA[$z]= $tmp[$z];if($currA[$z]<0){$x=4;}
				    }
				}elsif($tmp[0] =~ m/^C\|/){
				    $tmp[0] =~ s/C\|//g;
				    for($z=0; $z<=$#tmp; $z++){
					$currC[$z]= $tmp[$z];if($currC[$z]<0){$x=4;}
				    }if($#currC==$#currA){$base_cols++;}
				}elsif($tmp[0] =~ m/^G\|/){
				    $tmp[0] =~ s/G\|//g;
				    for($z=0; $z<=$#tmp; $z++){
					$currG[$z]= $tmp[$z];if($currG[$z]<0){$x=4;}
				    }if($#currG==$#currA){$base_cols++;}
				}elsif($tmp[0] =~ m/^T\|/){
				    $tmp[0] =~ s/T\|//g;
				    for($z=0; $z<=$#tmp; $z++){
					$currT[$z]= $tmp[$z];if($currT[$z]<0){$x=4;}
				    }if($#currT==$#currA){$base_cols++;}
				}$i++;
			}
			if($base_cols==4){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}

	######################################################################
	}else{### Now deal with the individual motif formats
	######################################################################
		if($#curr>=0 && ($curr[0] eq "DE" || $curr[0] eq "NA" || $curr[0] eq "PO" || $curr[0] eq "P0" || $curr[0] eq "AC")){#TRANSFAC Format
			$currTag = $curr[0];
			if($currTag eq "DE" || $currTag eq "NA" || $currTag eq "AC"){
				@name = split(/\s+/, $curr[1]);
				$InfName = $name[0];
				$WeightOrFam ="";
				if($#curr>1 && $curr[2] ne ""){
					$WeightOrFam = $curr[2];
				}
			}else{
				$tmpNum = $numMotifs+1;
				$InfName = "Motif".$tmpNum;
				$WeightOrFam ="";
			}
			#if this is a DE/NA transfac motif, there may be some other lines to come before the matrix starts
			$abort=0; $found=0;
			while($found==0 && $abort==0){
				@tmp= split(/\s+/,  $linesCurr[$i+1]);
				if($tmp[0] eq "DE" || $tmp[0] eq "NA"){
					@name = split(/\s+/, $tmp[1]);
					$InfName = $name[0];
				}
				if($#tmp ==4 || $#tmp ==5){$found=1;}
				foreach $tag (@TransfacTags){if($tmp[0] =~ m/$tag/){$found=0;}}
				foreach $tag (@NonTransMotifTags){if($tmp[0] =~ m/$tag/){$found=0;}}
				if($tmp[0] eq $currTag){$abort=1;
				}else{$i++;}
			}

			if($abort==0){
				$finished=0;
				$x=0;
				while($i<=$#linesCurr && $finished==0){
					@tmp = split(" ",  $linesCurr[$i]);
					foreach $tag (@MotifTags){if($tmp[0] =~ m/$tag/){$finished=1; $i--;}}
					if($finished==0 && ($#tmp ==4 || $#tmp ==5)){
						$currA[$x]=$tmp[1];
						$currC[$x]=$tmp[2];
						$currG[$x]=$tmp[3];
						$currT[$x]=$tmp[4];
						if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
							$finished=1; $x=0;
						}
						$x++;
						$i++;
					}else{
						$finished=1;
					}
				}
				if($x>0){
					print "$InfName\n";
					$good=1;
					$numMotifs++;
				}
			}

		}elsif($curr[0] =~ m/letter-probability/ && $i>=2 && $linesCurr[$i-2] =~m/position-specific probability matrix/){
			###MEME single motif format
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$WeightOrFam ="";
			@tmp = split(" ",  $linesCurr[$i+1]);
			if($#tmp ==3){
				$i++;$finished=0;$x=0;
				while($i<=$#linesCurr && $finished==0){
					@tmp = split(" ",  $linesCurr[$i]);
					if($#tmp>=0){
						foreach $tag (@MotifTags){if($tmp[0] eq $tag){$finished=1; $i--;} if($finished==0 && $tmp[0] =~ m/\>/){$finished=1; $i--;}}
						if($finished==0 && $#tmp!=3){$finished=1;}
					}

					if($finished==0 && ($#tmp ==3)){
						$currA[$x]=$tmp[0];
						$currC[$x]=$tmp[1];
						$currG[$x]=$tmp[2];
						$currT[$x]=$tmp[3];
						if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
							$finished=1; $x=0;
						}
						$x++;
						$i++;
					}else{
						$finished=1;
					}
				}
				if($x>0){
					print "$InfName\n";
					$good=1;
					$numMotifs++;
				}
			}
		}elsif($linesCurr[$i] =~ m/\<motif\>/){ ### XMS format
			$tmpNum = $numMotifs+1;
			$InfName = "Motif".$tmpNum;
			$x=0; $keepGoing=1;
			while($i<=$#linesCurr && $linesCurr[$i]!~ m/\<\/motif\>/ && $keepGoing==1){
				if($linesCurr[$i] =~ m/\<name\>/){
					$sTag="name";
					@tmpParse = split(/$sTag/, $linesCurr[$i]);
					$tmpParse[1] =~ tr/\>\<\\\///d;
					$InfName=$tmpParse[1];

				}elsif($linesCurr[$i] =~ m/\<weightmatrix/ && $linesCurr[$i] !~ m/DNA/){
					$keepGoing=0;
				}elsif($linesCurr[$i] =~ m/\<column/){
					$sTag="pos=";
					@tmpParse = split(/$sTag/, $linesCurr[$i]);
					$tmpParse[1] =~ tr/\>\<\" \t\\\n//d;
					$x=$tmpParse[1];
				}elsif($linesCurr[$i] =~ m/\<weight/ && $linesCurr[$i] =~ m/symbol/){
					@tmpParse = split(/\>/, $linesCurr[$i]);
					@tmpParse2 = split(/\</, $tmpParse[1]);
					$tmpParse2[0] =~ tr/ \t\n\\//d;
					$weightValue = $tmpParse2[0];
					if($linesCurr[$i] =~ m/adenine/){
						$currA[$x]=$weightValue;
					}elsif($linesCurr[$i] =~ m/cytosine/){
						$currC[$x]=$weightValue;
					}elsif($linesCurr[$i] =~ m/guanine/){
						$currG[$x]=$weightValue;
					}elsif($linesCurr[$i] =~ m/thymine/){
						$currT[$x]=$weightValue;
					}
				}
				$i++;
			}
			if($x>0){
				print "$InfName\n";
				$good=1;
				$numMotifs++;
			}
		}elsif($firstWord[0] eq ">"){	###Various formats
			#Get name here
			if(length($curr[0])>1){
			    $InfName = $curr[0];
			    $InfName =~ tr/\>//d;
			}else{
				if($#curr>0){
					$InfName = $curr[1];
					$WeightOrFam ="";
					if($#curr>1 && $curr[2] ne ""){
						$WeightOrFam = $curr[2];
					}
				}else{
					$tmpNum = $numMotifs+1;
					$InfName = "Motif".$tmpNum;
					$WeightOrFam ="";
				}
			}

			@tmp= split(" ",  $linesCurr[$i+1]);

			if($tmp[0] eq "A" && $#tmp>1){###JASPAR format
				$base_cols=0;
				for($x=0; $x<4; $x++){
					$i++;
					$linesCurr[$i] =~ tr/\[\]//d;
					@tmp = split(" ",  $linesCurr[$i]);
					if($tmp[0] eq "A"){$base_cols++;
						for($z=1; $z<=$#tmp; $z++){
						    $currA[$z-1]= $tmp[$z];if($currA[$z-1]<0){$x=4;}
						}
					}elsif($tmp[0] eq "C"){
						for($z=1; $z<=$#tmp; $z++){
							$currC[$z-1]= $tmp[$z];if($currC[$z-1]<0){$x=4;}
						}if($#currC==$#currA){$base_cols++;}
					}elsif($tmp[0] eq "G"){
						for($z=1; $z<=$#tmp; $z++){
							$currG[$z-1]= $tmp[$z];if($currG[$z-1]<0){$x=4;}
						}if($#currG==$#currA){$base_cols++;}
					}elsif($tmp[0] eq "T"){
						for($z=1; $z<=$#tmp; $z++){
							$currT[$z-1]= $tmp[$z];if($currT[$z-1]<0){$x=4;}
						}if($#currT==$#currA){$base_cols++;}
					}else{
						if($#tmp>=0){foreach $tag (@MotifTags){if($tmp[0] eq $tag){$finished=1; $i--;} if($finished==0 && $tmp[0] =~ m/\>/){$finished=1; $i--;}}}
					}
				}
				if($base_cols==4){
					print "$InfName\n";
					$good=1;
					$numMotifs++;
				}
			}else{
				$noTag = 1;
				if($#tmp>=0){foreach $tag (@MotifTags){if($tmp[0] eq $tag){$noTag=0; } if($tmp[0] =~ m/\>/){$noTag=0;}}}
				if($noTag==1 && ($#tmp ==3)){###Raw PSSM format (similar to TRANSFAC)
					$finished=0;
					$x=0;
					$i++;
					while($i<=$#linesCurr && $finished==0){
						@tmp = split(" ",  $linesCurr[$i]);
						if($#tmp>=0){foreach $tag (@MotifTags){if($tmp[0] eq $tag){$finished=1; $i--;} if($finished==0 && $tmp[0] =~ m/\>/){$finished=1; $i--;}}
						}else{$finished=1; $i--;}

						if($finished==0 && ($#tmp ==3)){
							$currA[$x]=$tmp[0];
							$currC[$x]=$tmp[1];
							$currG[$x]=$tmp[2];
							$currT[$x]=$tmp[3];
							if($currA[$x]<0 || $currC[$x]<0 || $currG[$x]<0 || $currT[$x]<0){
								$finished=1; $x=0;
							}
							$x++;
							$i++;
						}else{
							$finished=1;
						}
					}
					if($x>0){
						print "$InfName\n";
						$good=1;
						$numMotifs++;
					}
				}elsif($noTag==1 && ($#tmp ==0)){###Consensus Sequence / Sequence alignment
					$finished=0;
					$x=length($tmp[0]);
					for($c=0; $c<$x; $c++){
						$currA[$c]=0;
						$currC[$c]=0;
						$currG[$c]=0;
						$currT[$c]=0;
					}
					$i++;
					while($i<=$#linesCurr && $finished==0){
						@tmp = split(" ",  $linesCurr[$i]);
						if($#tmp>=0){foreach $tag (@MotifTags){if($tmp[0] eq $tag){$finished=1; $i--;} if($finished==0 && $tmp[0] =~ m/\>/){$finished=1; $i--;}}
						}else{$finished=1; $i--;}

						if($finished==0 && ($#tmp ==0)){
							$seq = $tmp[0];
							$seq =~ tr/a-z/A-Z/;
							if(length($seq)!=$x){#length inconsistency
								$finished=1; $x=0;
							}else{
								@currSeqBP = split(//, $seq);
								for($c=0; $c<=$#currSeqBP; $c++){
									@currBase = consensus2column($currSeqBP[$c]);

									$currA[$c]+=$currBase[0];
									$currC[$c]+=$currBase[1];
									$currG[$c]+=$currBase[2];
									$currT[$c]+=$currBase[3];
									if($currA[$c]<0 || $currC[$c]<0 || $currG[$c]<0 || $currT[$c]<0){
										$finished=1; $x=0;
									}
								}
							}
							$i++;
						}else{
							$finished=1;
						}
					}
					if($x>0){
						print "$InfName\n";
						$good=1;
						$numMotifs++;
					}
				}
			}
		}
	}
	}
	#############################################################
	## End of translation area
	#############################################################

	#trim the motif if necessary
	if($trimming==1 && $good==1){
		$curr_m_len = $#currA+1;
		for($j=0; $j<=$#currA; $j++) {
			$tmpA[$j] = $currA[$j];$tmpC[$j] = $currC[$j];$tmpG[$j] = $currG[$j];$tmpT[$j] = $currT[$j];
		}
		@currA = "";@currC = "";@currG = "";@currT = "";
		$core_start=0;

		##Find the core region of greatest IC
		$maxIC=0;
		for($y1=0; $y1<$curr_m_len-$coreLen; $y1++){
			$totalIC=0;
			for($y2=$y1; $y2<$y1+$coreLen; $y2++){
				$totalIC += calcIC($tmpA[$y2],$tmpC[$y2],$tmpG[$y2],$tmpT[$y2]);
			}
			if($totalIC>$maxIC){
				$maxIC=$totalIC; $core_start=$y1;
			}
		}
		##now scan either side of the alignment, deleting columns as necessary
		$mStart=0; $mStop =$curr_m_len-1;
		$run=0;
		for($y1=0; $y1<$core_start && $run==0; $y1++){
			$tmpIC = calcIC($tmpA[$y1],$tmpC[$y1],$tmpG[$y1],$tmpT[$y1]);
			if($tmpIC<$minIC){
				$mStart++;
			}else{
				$run=1;
			}
		}$run=0;
		for($y1=$curr_m_len-1; $y1>=$core_start+$coreLen && $run==0; $y1--){
			$tmpIC = calcIC($tmpA[$y1],$tmpC[$y1],$tmpG[$y1],$tmpT[$y1]);
			if($tmpIC<$minIC){
				$mStop--;
			}else{
				$run=1;
			}
		}
		##Copy the new motif into the matrix
		$y2=0;
		for($y1=$mStart; $y1<=$mStop; $y1++){
			$currA[$y2] = $tmpA[$y1];
			$currC[$y2] = $tmpC[$y1];
			$currG[$y2] = $tmpG[$y1];
			$currT[$y2] = $tmpT[$y1];
			$y2++;
		}#printf("%s before %f\t", $f_count{$tmp[4]}[2], $curr_m_len);
		$curr_m_len = ($mStop-$mStart)+1;

	}

	#print the motif
	if($good==1){
		if($numMotifs<=$maxNumMotifsOut){
			$InfName =~ tr/\#\{\}\~\;\"\'\@\%\$\£\!\?\*\^\&\/\>\<\|\:\(\)\[\]/_/s;
			if(length($InfName) > $maxFilename){
				$tmp = substr($InfName, 0, ($maxFilename-4));
				$InfName = $tmp;
			}
			$nameCheck{$InfName}++;
			if($nameCheck{$InfName}>1){
				$InfName = $InfName."_v".$nameCheck{$InfName};
			}
			if($numMotifs==1){
				if($append==0){
					open(OUT, ">", $outFilename) || die("Can't open output file: $!");
				}else{
					open(OUT, ">>", $outFilename) || die("Can't open output file: $!");
				}
			}
			#Hack
			$InfName=~ s/GimmeMotifs/GM/g;
			print OUT "DE\t$namePrefix$InfName$namePostfix\t$WeightOrFam\n";
			for($j=0; $j<=$#currA; $j++) {
				#print consensus at end here
				$currCons = column2consensus($currA[$j],$currC[$j],$currG[$j],$currT[$j]);
				print OUT "$j\t$currA[$j]\t$currC[$j]\t$currG[$j]\t$currT[$j]\t$currCons\n";
			}
			print OUT "XX\n";
		}

	}
}
if($numMotifs !=0){
	close(OUT);
}

print "$numMotifs motifs Converted\n";
}

sub calcIC {
	$sum = 0;
	$total=0;
	for($ic=0; $ic<4; $ic++){
		if($_[$ic]>0){
			$total+=$_[$ic];
		}
	}
	for($ic=0; $ic<4; $ic++){
		if($_[$ic]>0){
			$sum +=$_[$ic]/$total * (log($_[$ic]/$total)/log(2));
		}
	}
	#printf("%f\n",2+$sum);
	return(2+$sum);
}

#Returns the consensus letter for this column
sub column2consensus{
	@f=();
	$f[0] = $_[0];
	$f[1] = $_[1];
	$f[2] = $_[2];
	$f[3] = $_[3];
	#Hard-coded consensus alphabet rules
	@two_base_l = ("Y", "R", "W", "S", "K", "M");

	$sum=0;
	for($g=0; $g<4; $g++){
		$sum+=$f[$g];
	}

	@two_base_c =();
	$two_base_c[0]=($f[1]+$f[3])/$sum;
	$two_base_c[1]=($f[0]+$f[2])/$sum;
	$two_base_c[2]=($f[0]+$f[3])/$sum;
	$two_base_c[3]=($f[1]+$f[2])/$sum;
	$two_base_c[4]=($f[2]+$f[3])/$sum;
	$two_base_c[5]=($f[0]+$f[1])/$sum;

	if($f[0]/$sum>=$CONS1) {$curr="A";}
	elsif($f[1]/$sum>=$CONS1) {$curr="C";}
	elsif($f[2]/$sum>=$CONS1) {$curr="G";}
	elsif($f[3]/$sum>=$CONS1) {$curr="T";}
	else {
		$curr="N";
		$p_max=$CONS2;
		for($h=0;$h<6;$h++) {
			if($two_base_c[$h]>=$p_max) {
				$p_max=$two_base_c[$h];
				$curr=$two_base_l[$h];
			}
		}
	}

	return($curr);
}
#convert a consensus base to a column
sub consensus2column{
	$currBase = $_[0];
	@retCol = ();
	$retCol[0]=0; $retCol[1]=0; $retCol[2]=0; $retCol[3]=0;
	if($currBase eq "A"){$retCol[0]=1;
	}elsif($currBase eq "C"){$retCol[1]=1;
	}elsif($currBase eq "G"){$retCol[2]=1;
	}elsif($currBase eq "T"){$retCol[3]=1;
	}elsif($currBase eq "M"){$retCol[0]=0.5;$retCol[1]=0.5;
	}elsif($currBase eq "R"){$retCol[0]=0.5;$retCol[2]=0.5;
	}elsif($currBase eq "W"){$retCol[0]=0.5;$retCol[3]=0.5;
	}elsif($currBase eq "S"){$retCol[1]=0.5;$retCol[2]=0.5;
	}elsif($currBase eq "Y"){$retCol[1]=0.5;$retCol[3]=0.5;
	}elsif($currBase eq "K"){$retCol[2]=0.5;$retCol[3]=0.5;
	}elsif($currBase eq "V"){$retCol[0]=0.333;$retCol[1]=0.333;$retCol[2]=0.333;
	}elsif($currBase eq "H"){$retCol[0]=0.333;$retCol[1]=0.333;$retCol[3]=0.333;
	}elsif($currBase eq "D"){$retCol[0]=0.333;$retCol[2]=0.333;$retCol[3]=0.333;
	}elsif($currBase eq "B"){$retCol[1]=0.333;$retCol[2]=0.333;$retCol[3]=0.333;
	}elsif($currBase eq "N"){$retCol[0]=0.25;$retCol[1]=0.25;$retCol[2]=0.25;$retCol[3]=0.25;
	}else{#Gap, do nothing
	}
	return(@retCol);
}
