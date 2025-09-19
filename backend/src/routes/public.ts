import { Router } from 'express';
import { asyncHandler } from '../services/errorHandler';
import { validate, publicStatusFiltersSchema } from '../validators/schemas';
import { supabase } from '../services/supabase';

const router = Router();

// GET /api/public/:orgSlug - Get public status page for organization
router.get('/:orgSlug', 
  validate(publicStatusFiltersSchema, 'query'),
  asyncHandler(async (req: any, res: any) => {
    const { orgSlug } = req.params;
    const { team_slug, include_incidents, include_maintenances, days } = req.query;
    
    try {
      // Get organization by slug
      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug, created_at')
        .eq('slug', orgSlug)
        .single();

      if (orgError || !organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }

      // Build team filter
      let teamFilter = supabase
        .from('teams')
        .select('id, name, slug, organization_id')
        .eq('organization_id', organization.id);

      if (team_slug) {
        teamFilter = teamFilter.eq('slug', team_slug);
      }

      const { data: teams, error: teamsError } = await teamFilter;

      if (teamsError) {
        throw new Error('Failed to fetch teams');
      }

      if (team_slug && (!teams || teams.length === 0)) {
        return res.status(404).json({
          success: false,
          message: 'Team not found',
          code: 'TEAM_NOT_FOUND'
        });
      }

      const teamIds = teams?.map(team => team.id) || [];

      // Get services for the teams
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('id, name, description, status, team_id, teams(id, name, slug)')
        .in('team_id', teamIds)
        .order('name');

      if (servicesError) {
        throw new Error('Failed to fetch services');
      }

      // Get recent incidents if requested
      let incidents = [];
      if (include_incidents && services && services.length > 0) {
        const serviceIds = services.map(service => service.id);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const { data: incidentsData, error: incidentsError } = await supabase
          .from('incidents')
          .select(`
            id, title, description, status, severity, created_at, resolved_at,
            services(id, name, team_id, teams(name, slug))
          `)
          .in('service_id', serviceIds)
          .gte('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false });

        if (!incidentsError && incidentsData) {
          incidents = incidentsData;
        }
      }

      // Get upcoming maintenances if requested
      let maintenances = [];
      if (include_maintenances && services && services.length > 0) {
        const serviceIds = services.map(service => service.id);
        const now = new Date();

        const { data: maintenancesData, error: maintenancesError } = await supabase
          .from('maintenances')
          .select(`
            id, title, description, status, scheduled_start, scheduled_end,
            services(id, name, team_id, teams(name, slug))
          `)
          .in('service_id', serviceIds)
          .gte('scheduled_end', now.toISOString())
          .neq('status', 'cancelled')
          .order('scheduled_start');

        if (!maintenancesError && maintenancesData) {
          maintenances = maintenancesData;
        }
      }

      // Calculate overall status
      const statusCounts = services?.reduce((acc: any, service: any) => {
        acc[service.status] = (acc[service.status] || 0) + 1;
        return acc;
      }, {}) || {};

      let overallStatus = 'operational';
      if (statusCounts.major_outage > 0) {
        overallStatus = 'major_outage';
      } else if (statusCounts.partial_outage > 0) {
        overallStatus = 'partial_outage';
      } else if (statusCounts.degraded > 0) {
        overallStatus = 'degraded';
      }

      // Group services by team
      const servicesByTeam = services?.reduce((acc: any, service: any) => {
        const teamId = service.team_id;
        if (!acc[teamId]) {
          acc[teamId] = {
            team: service.teams,
            services: []
          };
        }
        acc[teamId].services.push({
          id: service.id,
          name: service.name,
          description: service.description,
          status: service.status
        });
        return acc;
      }, {}) || {};

      res.json({
        success: true,
        data: {
          organization: {
            name: organization.name,
            slug: organization.slug
          },
          overall_status: overallStatus,
          status_summary: statusCounts,
          teams: Object.values(servicesByTeam),
          incidents: incidents || [],
          maintenances: maintenances || [],
          last_updated: new Date().toISOString(),
          filters: {
            team_slug: team_slug || null,
            include_incidents,
            include_maintenances,
            days
          }
        }
      });
    } catch (error) {
      console.error('Error fetching public status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch status page data',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  })
);

// GET /api/public/:orgSlug/incidents - Get public incidents for organization
router.get('/:orgSlug/incidents',
  asyncHandler(async (req: any, res: any) => {
    const { orgSlug } = req.params;
    const { days = 30, limit = 50 } = req.query;
    
    try {
      // Get organization
      const { data: organization } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single();

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

      // Get incidents with service and team info
      const { data: incidents, error } = await supabase
        .from('incidents')
        .select(`
          id, title, description, status, severity, created_at, resolved_at,
          services(id, name, teams(id, name, slug, organization_id))
        `)
        .gte('created_at', cutoffDate.toISOString())
        .eq('services.teams.organization_id', organization.id)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit));

      if (error) {
        throw new Error('Failed to fetch incidents');
      }

      res.json({
        success: true,
        data: incidents || [],
        filters: {
          organization_slug: orgSlug,
          days: parseInt(days),
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching public incidents:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch incidents',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  })
);

// GET /api/public/:orgSlug/maintenances - Get public maintenances for organization
router.get('/:orgSlug/maintenances',
  asyncHandler(async (req: any, res: any) => {
    const { orgSlug } = req.params;
    const { upcoming = true, limit = 20 } = req.query;
    
    try {
      // Get organization
      const { data: organization } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', orgSlug)
        .single();

      if (!organization) {
        return res.status(404).json({
          success: false,
          message: 'Organization not found',
          code: 'ORGANIZATION_NOT_FOUND'
        });
      }

      let query = supabase
        .from('maintenances')
        .select(`
          id, title, description, status, scheduled_start, scheduled_end,
          services(id, name, teams(id, name, slug, organization_id))
        `)
        .eq('services.teams.organization_id', organization.id)
        .neq('status', 'cancelled')
        .limit(parseInt(limit));

      if (upcoming === 'true' || upcoming === true) {
        const now = new Date();
        query = query.gte('scheduled_end', now.toISOString());
        query = query.order('scheduled_start');
      } else {
        query = query.order('scheduled_start', { ascending: false });
      }

      const { data: maintenances, error } = await query;

      if (error) {
        throw new Error('Failed to fetch maintenances');
      }

      res.json({
        success: true,
        data: maintenances || [],
        filters: {
          organization_slug: orgSlug,
          upcoming: upcoming === 'true' || upcoming === true,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching public maintenances:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch maintenances',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  })
);

export default router;
