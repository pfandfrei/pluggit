CREATE TABLE IF NOT EXISTS `pluggit` (
  `timestamp` bigint(20) NOT NULL,
  `name` text NOT NULL,
  `serial` int(11) NOT NULL,
  `version` text NOT NULL,
  `t1` float NOT NULL COMMENT 'outside air',
  `t2` float NOT NULL COMMENT 'supply air',
  `t3` float NOT NULL COMMENT 'exhaust air',
  `t4` float NOT NULL COMMENT 'outgoing air',
  `t5` float NOT NULL COMMENT 'room',
  `filter_period` smallint(6) NOT NULL,
  `filter_reset` mediumint(9) NOT NULL,
  `humidity` smallint(6) NOT NULL,
  `bypass` set('closed','in process','closing','opening','opened') NOT NULL,
  `alarm` set('None','Exhaust FAN Alarm','Supply FAN Alarm','Bypass Alarm','T1 Alarm','T2 Alarm','T3 Alarm','T4 Alarm','T5 Alarm','RH Alarm','Outdoor13 Alarm','Supply5 Alarm','Fire Alarm','Communication Alarm','FireTermostat Alarm','VOC Alarm') NOT NULL,
  `speed` tinyint(4) NOT NULL,
  `work_time` int(11) NOT NULL,
  KEY `timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
