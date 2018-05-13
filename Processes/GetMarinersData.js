var request = require('request');
var cheerio = require('cheerio');
var fs = require('fs');
var json2csv = require('json2csv').Parser;

// option variables
var year_range = [1977, 2018];
var team = 'SEA';
var DEBUG = false;
var OUTPUT = true;
var output_filename = 'MarinersHistory.csv';

// program initial variables
var NEW_LINE_STRING = "\r\n";
var year = undefined;
var main_data = [];
var season_last_wins = 0;
var season_last_losses = 0;
var addCount = 0;

// initialize main program
main_initialize();

// utility functions
function isDefined(check_var) {
	return !(typeof check_var !== 'undefined');
}

function cloneObj(obj) {
	if (null == obj || "object" != typeof obj) {
		return obj;
	}
	var copy = obj.constructor();
	for (var attr in obj) {
		if (obj.hasOwnProperty(attr)) {
			copy[attr] = obj[attr];
		}
	}
	return copy;
}

// -----------------
// main programs
// -----------------
function main_initialize() {
	if (OUTPUT) {
		clearCSV();
	}
	for (year = year_range[0]; year <= year_range[1]; year++) {
		if (DEBUG) {
			year = year_range[1];
		}
		var url = 'https://www.baseball-reference.com/teams/' + team + '/' + year + '-schedule-scores.shtml';
		var season = year + 0;
		request(url, function (error, response, html) {
			handle_page_request(error, response, html, season);
		});
	}
}

// -----------------
// program functions
// -----------------
function handle_page_request(error, response, html, season) {
	if (!error) {
		season_last_wins = 0;
		season_last_losses = 0;
		var $ = cheerio.load(html);
		$('#team_schedule>tbody>tr:not(.thead)').each(function (i, element) {
			handle_season_schedule_row($, i, element, function (row) {
				// set season
				//row['season'] = season;

				// parse numeric variables
				row = convert_season_schedule_row(row);

				// code dummy and detail variables
				row = ETL_season_schedule_row(row);

				main_data.push(row);

				if (OUTPUT) {
					addToCSV([row]);
				}
			});
		});

		if (DEBUG) {
			console.log('INFO:', main_data.length);
		}
	} else {
		console.log('ERROR: ', season, -1, response.statusCode, error);
	}
	if (DEBUG) {
		console.log('INFO: ', main_data[0]);
	}
}

function handle_season_schedule_row($, i, element, callback) {
	var ele = $(element);
	var data = {};
	data['season'] = $('h1[itemprop=\'name\'] span:first-child').text();
	data['team_game'] = ele.children('th[data-stat=\'team_game\']').text();
	data['date_game'] = ele.children('td[data-stat=\'date_game\']').attr('csk');
	data['boxscore'] = ele.children('td[data-stat=\'boxscore\']').text();
	data['team_ID'] = ele.children('td[data-stat=\'team_ID\']').text();
	data['homeORvis'] = ele.children('td[data-stat=\'homeORvis\']').text();
	data['opp_ID'] = ele.children('td[data-stat=\'opp_ID\']').text();
	data['win_loss_result'] = ele.children('td[data-stat=\'win_loss_result\']').text();
	data['R'] = ele.children('td[data-stat=\'R\']').text();
	data['RA'] = ele.children('td[data-stat=\'RA\']').text();
	data['extra_innings'] = ele.children('td[data-stat=\'extra_innings\']').text();
	data['win_loss_record'] = ele.children('td[data-stat=\'win_loss_record\']').text();
	data['rank'] = ele.children('td[data-stat=\'rank\']').text();
	data['games_back'] = ele.children('td[data-stat=\'games_back\']').text();
	data['winning_pitcher'] = ele.children('td[data-stat=\'winning_pitcher\']').text();
	data['losing_pitcher'] = ele.children('td[data-stat=\'losing_pitcher\']').text();
	data['saving_pitcher'] = ele.children('td[data-stat=\'saving_pitcher\']').text();
	data['time_of_game'] = ele.children('td[data-stat=\'time_of_game\']').text();
	data['day_or_night'] = ele.children('td[data-stat=\'day_or_night\']').text();
	data['attendance'] = ele.children('td[data-stat=\'attendance\']').text();
	data['win_loss_streak'] = ele.children('td[data-stat=\'win_loss_streak\']').text();
	data['reschedule'] = ele.children('td[data-stat=\'reschedule\']').text();
	callback(data);
}

function convert_season_schedule_row(input) {
	var row = cloneObj(input);

	row['team_game_int'] = parseInt(row['team_game']);
	row['team_game_int'] = isNaN(row['team_game_int']) ? 0 : row['team_game_int'];

	row['R_int'] = parseInt(row['R']);
	row['R_int'] = isNaN(row['R_int']) ? 0 : row['R_int'];

	row['RA_int'] = parseInt(row['RA']);
	row['RA_int'] = isNaN(row['RA_int']) ? 0 : row['RA_int'];

	row['total_innings_int'] = parseInt(row['extra_innings']);
	// before recoding NaN in total_innings_int, use the NaN or INT values for extra innings
	row['extra_innings_int'] = isNaN(row['total_innings_int']) ? 0 : row['total_innings_int'];
	row['total_innings_int'] = isNaN(row['total_innings_int']) ? 9 : row['total_innings_int'];

	row['rank_int'] = parseInt(row['rank']);
	row['rank_int'] = isNaN(row['rank_int']) ? -1 : row['rank_int'];

	row['games_back_float'] = parseFloat(row['games_back']);
	row['games_back_float'] = isNaN(row['games_back_float']) ? 0.0 : row['games_back_float'];

	row['attendance_int'] = parseInt(row['attendance'].replace(',', ''));
	row['attendance_int'] = isNaN(row['attendance_int']) ? 0 : row['attendance_int'];

	return row;
}

function ETL_season_schedule_row(input) {
	var row = cloneObj(input);

	// add count variable for game
	row['game_count'] = 1;

	// add dummy variable for walk off
	if (row['win_loss_result'].indexOf('-wo') > -1) {
		row['walk_off'] = 1;
	} else {
		row['walk_off'] = 0;
	}

	// add dummy variables for team win or loss
	if (row['win_loss_result'].charAt(0) === 'W') {
		row['team_win'] = 1;
		row['team_lose'] = 0;
	} else {
		row['team_win'] = 0;
		row['team_lose'] = 1;
	}

	// add dummy variables for home or away game
	if (row['homeORvis'].indexOf('@') > -1) {
		row['home_game'] = 0;
		row['away_game'] = 1;
	} else {
		row['home_game'] = 1;
		row['away_game'] = 0;
	}

	// add dummy variables for day or night game
	if (row['day_or_night'].indexOf('D') > -1) {
		row['day_game'] = 1;
		row['night_game'] = 0;
	} else {
		row['day_game'] = 0;
		row['night_game'] = 1;
	}

	// parse win loss record for wins and losses
	if (row['win_loss_record'].indexOf('-') > -1) {
		var win_loss_record_parts = row['win_loss_record'].split('-');
		if (win_loss_record_parts.length == 2) {
			row['season_record_wins'] = isNaN(parseInt(win_loss_record_parts[0])) ? 0 : parseInt(win_loss_record_parts[0]);
			row['season_record_losses'] = isNaN(parseInt(win_loss_record_parts[1])) ? 0 : parseInt(win_loss_record_parts[1]);
			// log highest value in a season
			if (row['season_record_wins'] > season_last_wins) {
				season_last_wins = row['season_record_wins'];
			}
			// log highest value in a season
			if (row['season_record_losses'] > season_last_losses) {
				season_last_losses = row['season_record_losses'];
			}
		} else {
			// if not exactly 2 parts then error
			console.log('ERROR: ', row['season'], row['team_game_int'], 'unexpected number of parts for win loss record ', win_loss_record_parts.length, row['win_loss_record'], win_loss_record_parts[0]);
		}
	} else {
		// if future game then use most recent value
		if (row['boxscore'] == 'preview') {
			row['season_record_wins'] = season_last_wins;
			row['season_record_losses'] = season_last_losses;
		} else {

			console.log('ERROR: ', row['season'], row['team_game_int'], 'no dash in win loss record ', row['win_loss_record']);
		}
	}

	row['games_from_500'] = row.season_record_wins - (row.season_record_losses + row.season_record_wins) / 2;
	return row;
}

// -----------------
// Data Output
// -----------------
function clearCSV() {
	fs.unlinkSync(output_filename);
}

function createFileAndHeaders(fields) {
	//write the headers and newline
	console.log('INFO: ', 'New file, just writing headers');
	fields = (fields + NEW_LINE_STRING);

	fs.writeFile(output_filename, fields, function (err, stat) {
		if (err) throw err;
	});
}

function addToCSV(input) {
	addCount++;
	var fields = Object.keys(input[0]);
	var jsonParser = new json2csv({
		fields
	});
	var toCsv = {
		data: input,
		fields: fields,
		hasCSVColumnTitle: false
	};

	fs.stat(output_filename, function (err, stat) {
		if (!isDefined(stat) && addCount <= 1) {
			createFileAndHeaders(fields);
		}
		//write the actual data and end with newline
		var csv = jsonParser.parse(input, {
			fields,
			header: false
		}) + NEW_LINE_STRING;

		fs.appendFile(output_filename, csv, function (err) {
			if (err) throw err;
		});
	});
}
